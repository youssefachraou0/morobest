// Client-safe TMDB image helper — always request a sized rendition, never "original" for cards.
export type TmdbSize = "w92" | "w154" | "w185" | "w300" | "w342" | "w500" | "w780" | "w1280" | "h632";
export const tmdbImg = (path: string | null | undefined, size: TmdbSize = "w342") =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
export const posterSrcSet = (path: string | null) =>
  path ? `${tmdbImg(path, "w185")} 185w, ${tmdbImg(path, "w342")} 342w, ${tmdbImg(path, "w500")} 500w` : undefined;
export const backdropSrcSet = (path: string | null) =>
  path ? `${tmdbImg(path, "w780")} 780w, ${tmdbImg(path, "w1280")} 1280w` : undefined;
export const idFromSlug = (slug: string) => Number(slug.split("-").pop());
