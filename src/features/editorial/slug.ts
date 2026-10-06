/** Client-safe custom slug rules shared by the Admin form (live feedback) and the server (enforcement). */
export type SlugCheck = { ok: true } | { ok: false; reason: string; suggestion: string | null };

const clean = (s: string) =>
  s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);

/** Suggests a valid alternative without ever changing what the editor typed. */
export function suggestSlug(input: string, year?: number | null): string | null {
  let s = clean(input);
  const m = s.match(/^(.*?)-?(\d+)$/);
  if (m) s = m[1] ? (m[2]!.length === 4 ? `${m[1]}-${m[2]}-edition` : `${m[1]}-v${m[2]}`) : `title-${m[2]}-edition`;
  if (!s) return year ? `title-${year}-edition` : null;
  return s === input ? null : s;
}

export function validateSlug(input: string): SlugCheck {
  if (!input) return { ok: true };
  if (input.length > 120) return { ok: false, reason: "Slugs can be at most 120 characters.", suggestion: suggestSlug(input.slice(0, 120)) };
  if (/[A-Z]/.test(input)) return { ok: false, reason: "Use lowercase letters only.", suggestion: suggestSlug(input) };
  if (/\s/.test(input)) return { ok: false, reason: "Spaces are not allowed — use dashes between words.", suggestion: suggestSlug(input) };
  if (/[^a-z0-9-]/.test(input)) return { ok: false, reason: "Only letters a–z, numbers and dashes are allowed (no accents, Arabic letters or symbols).", suggestion: suggestSlug(input) };
  if (/^-|-$/.test(input)) return { ok: false, reason: "A slug cannot start or end with a dash.", suggestion: suggestSlug(input) };
  if (/--/.test(input)) return { ok: false, reason: "Use single dashes between words.", suggestion: suggestSlug(input) };
  if (/^\d+$/.test(input)) return { ok: false, reason: "A slug cannot be only a number — numbers alone are reserved for provider IDs.", suggestion: `title-${input}-edition` };
  if (/-\d+$/.test(input)) return { ok: false, reason: "A slug cannot end with “-number”: that ending is reserved for TMDB/AniList IDs, so the old provider link keeps working.", suggestion: suggestSlug(input) };
  return { ok: true };
}

export const describeSlugError = (c: SlugCheck) => (c.ok ? "" : `${c.reason}${c.suggestion ? ` Try “${c.suggestion}”.` : ""}`);
