/**
 * Slug rules shared by the archive.org importer and its tests (client-safe, no dependencies).
 *
 * MOROBEST reserves "dash + digits" at the end of a slug for TMDB/AniList ids, so an imported
 * title is never suffixed with a number — collisions are resolved with letters instead.
 */

export function archiveSlugify(input: string): string {
  const s = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return s && !/^\d+$/.test(s) ? s : "archive-film";
}

const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

/** First free slug for `base`, always free of the reserved trailing "-number" ending. */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 0; i < LETTERS.length; i++) {
    const candidate = i === 0 ? `${base}-archive` : `${base}-archive-${LETTERS[i]}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-archive-${Date.now().toString(36)}z`;
}
