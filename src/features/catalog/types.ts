import type { Locale } from "@/i18n/dictionary";

export type TitleKind = "movie" | "series" | "anime" | "manga";
export type Translation = { title: string; tagline: string | null; synopsis: string | null };
export type Translations = Partial<Record<Locale, Translation>>;

export type TitleCard = {
  id: string;
  slug: string;
  kind: TitleKind;
  originalTitle: string;
  year: number | null;
  rating: number | null;
  ageRating: number;
  status: string;
  format: string | null;
  poster: string | null;
  backdrop: string | null;
  runtime: number | null;
  isKids: boolean;
  popularity: number;
  tr: Translations;
};

export type Named = { slug: string; name_en: string; name_fr: string; name_ar: string };
export type Country = Named & { code: string; is_arab: boolean; region: string | null };

export type Episode = {
  id: string; number: number; title: string; synopsis: string | null; runtime_min: number | null;
  air_date: string | null; thumbnail_url: string | null;
};
export type Season = { id: string; number: number; name: string | null; year: number | null; episodes: Episode[] };
export type Chapter = { id: string; number: number; title: string | null; release_date: string | null; readable: boolean; official_url: string | null };
export type Volume = { id: string; number: number; release_date: string | null; cover_url: string | null; chapters: Chapter[] };
export type Credit = { role: string; character: string | null; person: { slug: string; name: string; name_ar: string | null; photo_url: string | null } };

export type TitleDetail = TitleCard & {
  releaseDate: string | null;
  trailer: string | null;
  studio: { name: string } | null;
  genres: Named[];
  countries: Country[];
  languages: { code: string; name_en: string; name_fr: string; name_ar: string }[];
  credits: Credit[];
  seasons: Season[];
  volumes: Volume[];
  related: (TitleCard & { relation: string })[];
  similar: TitleCard[];
};

export type ListSort = "popular" | "newest" | "oldest" | "rating" | "az";

export type ListParams = {
  kind?: TitleKind | TitleKind[];
  genre?: string;
  country?: string;
  arab?: boolean;
  kids?: boolean;
  classic?: boolean;
  status?: string;
  format?: string;
  year?: number;
  q?: string;
  sort?: ListSort;
  maxAge?: number;
  limit?: number;
  ids?: string[];
};
