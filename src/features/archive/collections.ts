/** Collections offered in the archive.org import picker (client-safe; the server validates the value). */
export const ARCHIVE_COLLECTIONS = [
  { id: "feature_films", label: "Feature films (public domain)" },
  { id: "moviesandfilms", label: "Movies and films" },
  { id: "classic_cartoons", label: "Classic cartoons" },
  { id: "prelinger", label: "Prelinger archives" },
  { id: "sabucat", label: "SabuCat (public domain)" },
  { id: "classic_tv", label: "Classic TV" },
  { id: "serials", label: "Serials" },
  { id: "noir", label: "Film noir" },
  { id: "short_films", label: "Short films" },
  { id: "blender_foundation", label: "Blender open movies" },
] as const;

export const ARCHIVE_COLLECTION_IDS: readonly string[] = ARCHIVE_COLLECTIONS.map((c) => c.id);
