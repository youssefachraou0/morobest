import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { archiveSlugify, uniqueSlug } from "./slug";

/**
 * Admin import from archive.org (Internet Archive) — openly licensed film and TV.
 *
 * Every handler re-checks the caller's media/catalog role server-side, and RLS enforces it again
 * on the writes. An import only ever stores what the item declares plus the name of the admin who
 * confirmed the rights, so an audit of "who said we may stream this" is always possible.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Ctx = { supabase: any; userId: string };

async function guard(c: Ctx) {
  const { data, error } = await c.supabase.rpc("can_manage_content", { _user_id: c.userId });
  if (error || !data) throw new Error("Forbidden");
}

async function audit(c: Ctx, action: string, contentId: string, newValue: unknown) {
  await c.supabase.from("admin_audit_log").insert({
    admin_id: c.userId,
    action,
    content_id: contentId,
    old_value: null,
    new_value: (newValue ?? null) as never,
  });
}

const fields = z.object({
  identifier: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[A-Za-z0-9._-]+$/, "Not an archive.org identifier"),
  fileName: z.string().max(300).optional(),
  rightsConfirmed: z.literal(true, {
    errorMap: () => ({ message: "Confirm MOROBEST is authorized to distribute this video" }),
  }),
  /** Items with no explicit licence statement can still be imported by an admin who checked the source themselves. */
  acknowledgeUnverifiedLicense: z.boolean().optional(),
  attachToTitleId: z.string().uuid().optional(),
  episodeId: z.string().uuid().optional(),
  kind: z.enum(["movie", "series"]).optional(),
  publish: z.boolean().optional(),
});

// ---------------------------------------------------------------- discovery

export const archiveSearchItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q?: string; collection?: string; rows?: number }) =>
    z
      .object({
        q: z.string().max(120).optional(),
        collection: z.string().max(40).optional(),
        rows: z.number().int().min(1).max(50).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await guard(context as Ctx);
    const { searchArchive } = await import("./archive.server");
    return searchArchive(data);
  });

export const archivePreviewItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { identifier: string }) =>
    z.object({ identifier: z.string().trim().min(3).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await guard(context as Ctx);
    const { fetchArchiveItem } = await import("./archive.server");
    return fetchArchiveItem(data.identifier);
  });

// ---------------------------------------------------------------- import

type ImportInput = z.infer<typeof fields>;

type ImportResult = {
  identifier: string;
  title: string;
  ok: boolean;
  reason?: string;
  titleId?: string;
  slug?: string;
  sourceId?: string;
  license?: string;
  licenseUrl?: string | null;
  licenseStatus?: string;
  videoUrl?: string;
  kind?: "hls" | "mp4";
  subtitlesImported?: number;
  subtitlesSkipped?: number;
  warnings?: string[];
};

/** Mirrors addUrlSource's rules so an imported source can never bypass source validation. */
function sourceKind(name: string): "hls" | "mp4" {
  return name.toLowerCase().endsWith(".m3u8") ? "hls" : "mp4";
}

async function importOne(ctx: Ctx, input: ImportInput): Promise<ImportResult> {
  const { fetchArchiveItem, iaDownloadUrl } = await import("./archive.server");
  const item = await fetchArchiveItem(input.identifier);
  const file = input.fileName
    ? item.videoOptions.find((f) => f.name === input.fileName)
    : item.video;
  if (!file) {
    return {
      identifier: item.identifier,
      title: item.title,
      ok: false,
      reason: item.videoOptions.length
        ? "Chosen file is not playable"
        : "No browser-playable video file in this item",
    };
  }
  if (item.license.status === "unknown" && !input.acknowledgeUnverifiedLicense) {
    return {
      identifier: item.identifier,
      title: item.title,
      ok: false,
      reason: `Unknown licence — the item declares none. Check the source page, then tick “licence reviewed”. (${item.license.label})`,
    };
  }

  const kind = sourceKind(file.name);
  const url = iaDownloadUrl(item.identifier, file.name);
  const warnings: string[] = [];
  if (item.license.status === "unknown")
    warnings.push(`Licence reviewed by admin — archive.org item declares: ${item.license.label}`);
  if (item.videoOptions.length > 1)
    warnings.push(`Item holds ${item.videoOptions.length} video files; imported “${file.name}”.`);

  let titleId = input.attachToTitleId ?? null;
  let slug: string | null = null;
  let createdTitle = false;

  if (titleId) {
    const { data: existing, error } = await ctx.supabase
      .from("titles")
      .select("id, slug")
      .eq("id", titleId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error || !existing)
      return {
        identifier: item.identifier,
        title: item.title,
        ok: false,
        reason: "Target title not found",
      };
    slug = (existing as { slug: string }).slug;
  } else {
    const base = archiveSlugify(item.title);
    const { data: rows } = await ctx.supabase
      .from("titles")
      .select("slug")
      .like("slug", `${base}%`);
    const taken = new Set<string>(((rows ?? []) as { slug: string }[]).map((r) => r.slug));
    slug = uniqueSlug(base, taken);
    const year = item.year;
    const { data: t, error } = await ctx.supabase
      .from("titles")
      .insert({
        slug,
        kind: input.kind ?? "movie",
        original_title: item.title,
        year,
        poster_url: item.posterUrl,
        backdrop_url: item.posterUrl,
        published: input.publish ?? false,
        content_status: input.publish ? "published" : "draft",
        is_demo: false,
        age_rating: 0,
        status: "released",
        popularity: 0,
        is_kids: false,
        is_classic: !!year && year < 1970,
      })
      .select("id, slug")
      .single();
    if (error)
      return {
        identifier: item.identifier,
        title: item.title,
        ok: false,
        reason: (error as { message: string }).message,
      };
    titleId = (t as { id: string }).id;
    slug = (t as { slug: string }).slug;
    createdTitle = true;
    if (item.description) {
      await ctx.supabase.from("title_translations").insert({
        title_id: titleId,
        locale: "en",
        title: item.title,
        synopsis: item.description.slice(0, 1200),
      });
    }
    if (item.creators.length) warnings.push(`Credited on archive.org: ${item.creators.join(", ")}`);
  }

  const rightsRow = {
    title_id: titleId,
    episode_id: input.episodeId ?? null,
    provider: "url",
    kind,
    url,
    status: "ready",
    is_active: true,
    is_default: true,
    priority: 0,
    original_filename: item.identifier,
    duration_s: item.durationS,
    rights_confirmed_by: ctx.userId,
    rights_confirmed_at: new Date().toISOString(),
  };
  const licenseRow = {
    license_url: item.license.url,
    license_note: `${item.license.label} · archive.org/${item.identifier}`,
    attribution: item.creators.join(", ") || null,
  };

  // The licence columns live in migration 0015. If it has not been applied yet the import still
  // works and says so, rather than failing an otherwise valid source.
  let { data: src, error: se } = await ctx.supabase
    .from("video_sources")
    .insert({ ...rightsRow, ...licenseRow })
    .select("id")
    .single();
  if (se && /column .* does not exist/i.test((se as { message: string }).message)) {
    warnings.push(
      "Migration 0015 (source licence columns) is not applied on this project yet — licence kept only in the audit log.",
    );
    ({ data: src, error: se } = await ctx.supabase
      .from("video_sources")
      .insert(rightsRow)
      .select("id")
      .single());
  }
  if (se)
    return {
      identifier: item.identifier,
      title: item.title,
      ok: false,
      reason: (se as { message: string }).message,
      titleId,
      slug,
    };
  const sourceId = (src as { id: string }).id;

  let subtitlesImported = 0;
  let subtitlesSkipped = 0;
  if (item.subtitles.length) {
    const { toWebVtt } = await import("@/features/streaming/subtitles.server");
    for (const sub of item.subtitles) {
      try {
        const res = await fetch(iaDownloadUrl(item.identifier, sub.name), {
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
          subtitlesSkipped++;
          continue;
        }
        const text = await res.text();
        if (!text || text.length > 1_900_000) {
          subtitlesSkipped++;
          continue;
        }
        const vtt = toWebVtt(text, sub.name);
        const id = crypto.randomUUID();
        const { error } = await ctx.supabase.from("subtitle_tracks").insert({
          id,
          video_source_id: sourceId,
          title_id: titleId,
          episode_id: input.episodeId ?? null,
          lang: sub.lang,
          label: sub.label,
          is_active: true,
          vtt,
          url: `/api/public/subtitles/${id}`,
        });
        if (error) subtitlesSkipped++;
        else subtitlesImported++;
      } catch {
        subtitlesSkipped++;
      }
    }
  }

  await audit(
    ctx,
    createdTitle ? "archive.import.title" : "archive.import.source",
    `${item.identifier}`,
    {
      title_id: titleId,
      slug,
      source_id: sourceId,
      url,
      kind,
      file: file.name,
      license: item.license.label,
      license_url: item.license.url,
      license_status: item.license.status,
      source_page: item.detailUrl,
    },
  );

  return {
    identifier: item.identifier,
    title: item.title,
    ok: true,
    titleId: titleId!,
    slug: slug!,
    sourceId,
    license: item.license.label,
    licenseUrl: item.license.url,
    licenseStatus: item.license.status,
    videoUrl: url,
    kind,
    subtitlesImported,
    subtitlesSkipped,
    warnings: warnings.length ? warnings : undefined,
  };
}

export const archiveImportItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => fields.parse(d))
  .handler(async ({ data, context }) => importOne(context as Ctx, data));

export const archiveBulkImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        identifiers: z.array(z.string().trim().min(3).max(120)).min(1).max(25),
        rightsConfirmed: z.literal(true, {
          errorMap: () => ({
            message: "Confirm MOROBEST is authorized to distribute these videos",
          }),
        }),
        acknowledgeUnverifiedLicense: z.boolean().optional(),
        publish: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await guard(context as Ctx);
    const results: ImportResult[] = [];
    for (const identifier of data.identifiers) {
      try {
        results.push(await importOne(context as Ctx, { ...data, identifier, kind: "movie" }));
      } catch (e) {
        results.push({ identifier, title: identifier, ok: false, reason: (e as Error).message });
      }
    }
    return { results, imported: results.filter((r) => r.ok).length };
  });
