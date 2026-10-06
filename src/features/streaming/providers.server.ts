// Server-only StreamingProvider implementations. Credentials are read from process.env inside calls.
export type SourceRow = {
  id: string; provider: string; kind: string; url: string; playback_id: string | null; provider_asset_id: string | null;
  requires_signed_token: boolean; language: string | null; quality: string | null; is_dubbed: boolean;
  audio_language?: string | null; is_test_source?: boolean;
  subtitles: { id?: string; lang: string; label: string; url: string; forced?: boolean; sdh?: boolean; default?: boolean }[];
};
export type Playable = {
  id: string; provider: string; kind: "hls" | "dash" | "mp4" | "embed"; url: string; language: string | null; audioLanguage: string | null;
  quality: string | null; isDubbed: boolean; isTest: boolean; subtitles: SourceRow["subtitles"]; expiresAt: number | null;
};
export type UploadTicket = { uploadUrl: string; uploadId: string; method: "PUT" | "POST" };
export type ProviderStatus = { status: "uploading" | "processing" | "ready" | "failed"; playbackId?: string; assetId?: string; error?: string; duration?: number };

export interface StreamingProvider {
  id: string;
  configured(): boolean;
  resolve(src: SourceRow): Promise<Playable>;
  createUpload?(opts: { signed: boolean; origin: string }): Promise<UploadTicket>;
  status?(src: { upload_id: string | null; provider_asset_id: string | null }): Promise<ProviderStatus>;
}

// Short-lived playback tokens: long enough for a feature-length session, never permanent.
const TOKEN_TTL = 3 * 3600;
const env = (k: string) => process.env[k];

export function safeUrl(u: string, kinds: string[] = ["https:"]) {
  try {
    const p = new URL(u);
    return kinds.includes(p.protocol) && !p.username && !p.password ? p.toString() : null;
  } catch { return null; }
}

// ---------- RS256 JWT for Mux signed playback (WebCrypto, workerd-safe) ----------
const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = ""; bytes.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
function derLen(n: number) { return n < 128 ? [n] : n < 256 ? [0x81, n] : [0x82, n >> 8, n & 255]; }
function pkcs1ToPkcs8(pkcs1: Uint8Array) {
  const algo = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const oct = [0x04, ...derLen(pkcs1.length)];
  const body = [0x02, 0x01, 0x00, ...algo, ...oct];
  const head = [0x30, ...derLen(body.length + pkcs1.length)];
  const res = new Uint8Array(head.length + body.length + pkcs1.length);
  res.set(head); res.set(body, head.length); res.set(pkcs1, head.length + body.length);
  return res;
}
async function signMux(playbackId: string, type: "v" | "t" = "v") {
  const kid = env("MUX_SIGNING_KEY_ID"), keyB64 = env("MUX_SIGNING_PRIVATE_KEY");
  if (!kid || !keyB64) throw new Error("Mux signing key not configured");
  const pem = atob(keyB64.trim());
  const isPkcs1 = pem.includes("BEGIN RSA PRIVATE KEY");
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", isPkcs1 ? pkcs1ToPkcs8(der) : der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL;
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid }))}.${b64url(JSON.stringify({ sub: playbackId, aud: type, exp, kid }))}`;
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return { token: `${unsigned}.${b64url(sig)}`, exp: exp * 1000 };
}

const base = (s: SourceRow) => ({
  id: s.id, provider: s.provider, language: s.language, audioLanguage: s.audio_language ?? s.language ?? null, quality: s.quality,
  isDubbed: s.is_dubbed, isTest: !!s.is_test_source, subtitles: s.subtitles ?? [],
});

/** Verifies Mux credentials with a harmless read; never returns or logs the credentials. */
export async function testMuxConnection(): Promise<"not_configured" | "connected" | "failed"> {
  if (!(env("MUX_TOKEN_ID") && env("MUX_TOKEN_SECRET"))) return "not_configured";
  try {
    const r = await fetch("https://api.mux.com/video/v1/assets?limit=1", { headers: { Authorization: muxAuth() } });
    return r.ok ? "connected" : "failed";
  } catch { return "failed"; }
}

// ---------- Mux ----------
const muxAuth = () => "Basic " + btoa(`${env("MUX_TOKEN_ID")}:${env("MUX_TOKEN_SECRET")}`);
async function mux(path: string, init?: RequestInit) {
  const r = await fetch(`https://api.mux.com/video/v1${path}`, { ...init, headers: { Authorization: muxAuth(), "Content-Type": "application/json" } });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Mux ${r.status}: ${j?.error?.messages?.[0] ?? "request failed"}`);
  return j.data;
}
export const muxProvider: StreamingProvider = {
  id: "mux",
  configured: () => !!(env("MUX_TOKEN_ID") && env("MUX_TOKEN_SECRET")),
  async resolve(s) {
    if (!s.playback_id || !/^[A-Za-z0-9]+$/.test(s.playback_id)) throw new Error("Mux source has no playback ID yet");
    if (s.requires_signed_token) {
      const { token, exp } = await signMux(s.playback_id);
      return { ...base(s), kind: "hls", url: `https://stream.mux.com/${s.playback_id}.m3u8?token=${token}`, expiresAt: exp };
    }
    return { ...base(s), kind: "hls", url: `https://stream.mux.com/${s.playback_id}.m3u8`, expiresAt: null };
  },
  async createUpload({ signed, origin }) {
    const d = await mux("/uploads", { method: "POST", body: JSON.stringify({ cors_origin: origin, new_asset_settings: { playback_policy: [signed ? "signed" : "public"], video_quality: "basic" } }) });
    return { uploadUrl: d.url, uploadId: d.id, method: "PUT" };
  },
  async status(src) {
    let assetId = src.provider_asset_id;
    if (!assetId && src.upload_id) {
      const u = await mux(`/uploads/${encodeURIComponent(src.upload_id)}`);
      if (u.status === "errored" || u.status === "cancelled" || u.status === "timed_out") return { status: "failed", error: u.error?.message ?? u.status };
      assetId = u.asset_id ?? null;
      if (!assetId) return { status: "uploading" };
    }
    if (!assetId) return { status: "failed", error: "No asset" };
    const a = await mux(`/assets/${encodeURIComponent(assetId)}`);
    if (a.status === "errored") return { status: "failed", assetId, error: a.errors?.messages?.[0] ?? "Mux processing failed" };
    if (a.status !== "ready") return { status: "processing", assetId };
    return { status: "ready", assetId, playbackId: a.playback_ids?.[0]?.id, duration: typeof a.duration === "number" ? a.duration : undefined };
  },
};

// ---------- Cloudflare Stream ----------
async function cf(path: string, init?: RequestInit) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env("CLOUDFLARE_ACCOUNT_ID")}/stream${path}`, {
    ...init, headers: { Authorization: `Bearer ${env("CLOUDFLARE_STREAM_TOKEN")}`, "Content-Type": "application/json" },
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.success) throw new Error(`Cloudflare ${r.status}: ${j?.errors?.[0]?.message ?? "request failed"}`);
  return j.result;
}
export const cloudflareProvider: StreamingProvider = {
  id: "cloudflare",
  configured: () => !!(env("CLOUDFLARE_ACCOUNT_ID") && env("CLOUDFLARE_STREAM_TOKEN") && env("CLOUDFLARE_STREAM_CUSTOMER_CODE")),
  async resolve(s) {
    const uid = s.provider_asset_id;
    if (!uid || !/^[a-f0-9]{32}$/i.test(uid)) throw new Error("Cloudflare source has no video ID");
    const host = `https://customer-${env("CLOUDFLARE_STREAM_CUSTOMER_CODE")}.cloudflarestream.com`;
    if (s.requires_signed_token) {
      const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL;
      const t = await cf(`/${uid}/token`, { method: "POST", body: JSON.stringify({ exp }) });
      return { ...base(s), kind: "hls", url: `${host}/${t.token}/manifest/video.m3u8`, expiresAt: exp * 1000 };
    }
    return { ...base(s), kind: "hls", url: `${host}/${uid}/manifest/video.m3u8`, expiresAt: null };
  },
  async createUpload({ signed }) {
    const d = await cf("/direct_upload", { method: "POST", body: JSON.stringify({ maxDurationSeconds: 4 * 3600, requireSignedURLs: signed }) });
    return { uploadUrl: d.uploadURL, uploadId: d.uid, method: "POST" };
  },
  async status(src) {
    const uid = src.provider_asset_id ?? src.upload_id;
    if (!uid) return { status: "failed", error: "No video" };
    const v = await cf(`/${encodeURIComponent(uid)}`);
    const state = v.status?.state;
    if (state === "error") return { status: "failed", assetId: uid, error: v.status?.errReasonText ?? "Processing failed" };
    if (v.readyToStream) return { status: "ready", assetId: uid };
    return { status: state === "pendingupload" ? "uploading" : "processing", assetId: uid };
  },
};

// ---------- Authorized direct URLs (HLS / DASH / MP4 / official embed) ----------
export const urlProvider: StreamingProvider = {
  id: "url",
  configured: () => true,
  async resolve(s) {
    const url = safeUrl(s.url);
    if (!url) throw new Error("Unsafe source URL");
    const kind = (["hls", "dash", "mp4", "embed"].includes(s.kind) ? s.kind : "hls") as Playable["kind"];
    return { ...base(s), kind, url, expiresAt: null };
  },
};

export function providerFor(id: string): StreamingProvider {
  if (id === "mux") return muxProvider;
  if (id === "cloudflare") return cloudflareProvider;
  return urlProvider;
}

// ---------- Tiny per-isolate rate limiter ----------
const hits = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) { hits.set(key, { n: 1, reset: now + windowMs }); return true; }
  h.n++;
  if (hits.size > 5000) hits.clear();
  return h.n <= max;
}
