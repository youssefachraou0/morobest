// MOROBEST normalized models for TMDB movie / TV metadata. The UI never sees raw TMDB JSON.
export type TmdbType = "movie" | "tv";
export type TmdbLocale = "en" | "fr" | "ar";

export type TmdbCard = {
  tmdbId: number;
  type: TmdbType;
  slug: string;
  title: string;
  originalTitle: string;
  poster: string | null; // path only, e.g. "/abc.jpg" — sized on the client via tmdbImg()
  backdrop: string | null;
  year: number | null;
  date: string | null;
  rating: number | null;
  votes: number;
  popularity: number;
  overview: string | null;
  language: string | null;
};

export type TmdbPersonCard = { id: number; slug: string; name: string; photo: string | null; role: string | null; knownFor?: string | null };

export type TmdbEpisode = {
  id: number; number: number; title: string; overview: string | null; still: string | null;
  airDate: string | null; runtime: number | null; rating: number | null;
};
export type TmdbSeasonSummary = { number: number; name: string; episodeCount: number; airDate: string | null; poster: string | null };
export type TmdbSeason = TmdbSeasonSummary & { overview: string | null; episodes: TmdbEpisode[] };

export type TmdbDetail = TmdbCard & {
  tagline: string | null;
  runtime: number | null;
  genres: { id: number; name: string }[];
  countries: { code: string; name: string }[];
  spokenLanguages: string[];
  status: string | null;
  cast: TmdbPersonCard[];
  directors: TmdbPersonCard[];
  writers: TmdbPersonCard[];
  creators: TmdbPersonCard[];
  companies: { id: number; name: string; logo: string | null }[];
  networks: { id: number; name: string; logo: string | null }[];
  trailer: string | null; // YouTube key
  images: string[]; // backdrop paths
  seasons: TmdbSeasonSummary[];
  totalEpisodes: number | null;
  recommendations: TmdbCard[];
  similar: TmdbCard[];
  watchSlug: string | null; // internal MOROBEST title linked to this TMDB id, if any
};

export type TmdbPerson = {
  id: number; slug: string; name: string; photo: string | null; biography: string | null;
  birthday: string | null; placeOfBirth: string | null; department: string | null;
  knownFor: TmdbCard[]; movies: (TmdbCard & { role: string | null })[]; tv: (TmdbCard & { role: string | null })[];
};

export type TmdbRow = { key: string; items: TmdbCard[]; seeAll?: { type: TmdbType; params: Record<string, string> } };
export type TmdbWorld = { hero: TmdbCard[]; rows: TmdbRow[] };
export type TmdbPage = { items: TmdbCard[]; page: number; hasNext: boolean; total: number };
export type TmdbSearch = { movies: TmdbCard[]; tv: TmdbCard[]; people: TmdbPersonCard[] };
export type TmdbCountryPage = TmdbWorld & { people: TmdbPersonCard[]; genres: { id: number; name: string; type: TmdbType }[] };
