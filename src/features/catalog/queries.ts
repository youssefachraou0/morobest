import { queryOptions } from "@tanstack/react-query";
import {
  fetchCollection, fetchCollections, fetchHome, fetchRamadan, fetchTaxonomy, fetchTitle, fetchTitles,
} from "./catalog.functions";
import type { ListParams } from "./types";

const STALE = 5 * 60_000;

export const homeQuery = (maxAge?: number) =>
  queryOptions({ queryKey: ["home", maxAge ?? null], queryFn: () => fetchHome({ data: { maxAge } }), staleTime: STALE });

export const titlesQuery = (p: ListParams) =>
  queryOptions({ queryKey: ["titles", p], queryFn: () => fetchTitles({ data: p }), staleTime: STALE });

export const titleQuery = (slug: string) =>
  queryOptions({ queryKey: ["title", slug], queryFn: () => fetchTitle({ data: { slug } }), staleTime: STALE });

export const taxonomyQuery = () =>
  queryOptions({ queryKey: ["taxonomy"], queryFn: () => fetchTaxonomy(), staleTime: 60 * 60_000 });

export const ramadanQuery = (year?: number, maxAge?: number) =>
  queryOptions({ queryKey: ["ramadan", year ?? null, maxAge ?? null], queryFn: () => fetchRamadan({ data: { year, maxAge } }), staleTime: STALE });

export const collectionsQuery = () =>
  queryOptions({ queryKey: ["collections"], queryFn: () => fetchCollections(), staleTime: STALE });

export const collectionQuery = (slug: string, maxAge?: number) =>
  queryOptions({ queryKey: ["collection", slug, maxAge ?? null], queryFn: () => fetchCollection({ data: { slug, maxAge } }), staleTime: STALE });
