import { useQuery } from "@tanstack/react-query";
import { slugMapQuery } from "./editorial.functions";

/** The single place that builds public content URLs. Priority: MOROBEST custom slug → stable provider slug (ends in -id). */
export type ContentRef =
  | { kind: "movie" | "series" | "anime" | "manga"; providerId: number | string; slug: string }
  | { kind: "title"; slug: string };
export type CanonicalLink =
  | { to: "/movie/$slug" | "/tv/$slug" | "/anime/$slug" | "/manga/$slug" | "/title/$slug"; params: { slug: string } };

const PATH = { movie: "/movie/$slug", series: "/tv/$slug", anime: "/anime/$slug", manga: "/manga/$slug" } as const;

export function getCanonicalContentUrl(content: ContentRef, slugs: Record<string, string> | undefined): CanonicalLink {
  if (content.kind === "title") {
    const link = slugs?.[`title:${content.slug}`];
    if (!link) return { to: "/title/$slug", params: { slug: content.slug } };
    const [ct, pid] = link.split("|") as [string, string];
    const kind = (ct === "movie" || ct === "anime" || ct === "manga" ? ct : "series") as "movie" | "series" | "anime" | "manga";
    return getCanonicalContentUrl({ kind, providerId: pid, slug: `${content.slug}-${pid}` }, slugs);
  }
  const custom = slugs?.[`${content.kind}:${content.providerId}`];
  return { to: PATH[content.kind], params: { slug: custom ?? content.slug } };
}
export const canonicalHref = (l: CanonicalLink) => l.to.replace("$slug", encodeURIComponent(l.params.slug));

/** React helper: the slug map is prefetched by the root loader, so SSR renders canonical links directly. */
export function useCanonical() {
  const { data } = useQuery(slugMapQuery());
  return (c: ContentRef) => getCanonicalContentUrl(c, data);
}

/** Analytics key for provider content ("tmdb:movie:550") or MOROBEST titles ("mb:<uuid>"). */
export const contentKey = (kind: "movie" | "series" | "anime" | "manga", id: number | string) =>
  `${kind === "anime" || kind === "manga" ? "anilist" : "tmdb"}:${kind}:${id}`;
