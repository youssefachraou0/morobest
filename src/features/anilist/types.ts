// MOROBEST normalized models for AniList-backed anime & manga. The UI never sees raw GraphQL.
export type AniType = "ANIME" | "MANGA";

export type AniCard = {
  aniListId: number;
  type: AniType;
  slug: string;
  title: string;
  originalTitle: string;
  nativeTitle: string | null;
  poster: string | null;
  backdrop: string | null;
  color: string | null;
  year: number | null;
  status: string | null;
  format: string | null;
  score: number | null;
  popularity: number;
  episodeCount: number | null;
  chapters: number | null;
  volumes: number | null;
  genres: string[];
  country: string | null;
  synopsis: string | null;
  nextEpisode: { episode: number; airingAt: number } | null;
};

export type AniPerson = { id: number; name: string; native: string | null; image: string | null; role: string | null };
export type AniCharacter = AniPerson & { voiceActor: AniPerson | null };

export type AniDetail = AniCard & {
  duration: number | null;
  season: string | null;
  startDate: string | null;
  endDate: string | null;
  tags: { name: string; rank: number }[];
  meanScore: number | null;
  favourites: number;
  source: string | null;
  studios: { id: number; name: string }[];
  trailer: { site: string; id: string } | null;
  characters: AniCharacter[];
  staff: AniPerson[];
  relations: (AniCard & { relation: string })[];
  recommendations: AniCard[];
  externalLinks: { site: string; url: string }[];
  siteUrl: string;
};

export type AniPage = { items: AniCard[]; page: number; hasNext: boolean; total: number };

export type AniBrowse = {
  type: AniType;
  page?: number;
  sort?: "TRENDING_DESC" | "POPULARITY_DESC" | "SCORE_DESC" | "START_DATE_DESC";
  genre?: string;
  year?: number;
  season?: "WINTER" | "SPRING" | "SUMMER" | "FALL";
  format?: string;
  status?: "RELEASING" | "FINISHED" | "NOT_YET_RELEASED" | "CANCELLED" | "HIATUS";
  country?: "JP" | "KR" | "CN" | "TW";
  q?: string;
  minScore?: number;
};

export type AniHome = { hero: AniCard[]; rows: { key: string; items: AniCard[] }[] };
