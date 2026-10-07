/** Shapes shared by the archive.org importer, its server functions and the admin UI. */

export type IaFile = {
  name?: string;
  format?: string;
  size?: string | number;
  length?: string;
  source?: string;
  track?: string;
};
export type IaMetadata = Record<string, unknown>;
export type IaRaw = {
  files?: IaFile[];
  metadata?: IaMetadata;
  is_dark?: boolean;
  server?: string;
  dir?: string;
};

export type ArchiveVideoFile = {
  name: string;
  format: string;
  sizeBytes: number;
  durationS: number | null;
};
export type ArchiveSubtitleFile = { name: string; lang: string; label: string; caption: string };
export type LicenseStatus = "public-domain" | "open" | "unknown";
export type LicenseInfo = { status: LicenseStatus; label: string; url: string | null };

export type ArchiveItem = {
  identifier: string;
  title: string;
  year: number | null;
  description: string | null;
  creators: string[];
  collections: string[];
  downloads: number | null;
  license: LicenseInfo;
  posterUrl: string;
  detailUrl: string;
  sourceUrl: string;
  video: ArchiveVideoFile | null;
  videoOptions: ArchiveVideoFile[];
  subtitles: ArchiveSubtitleFile[];
  durationS: number | null;
};

export type ArchiveImportResult = {
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

export type ArchiveCollectionOption = { id: string; label: string };
