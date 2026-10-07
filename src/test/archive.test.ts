import { afterEach, describe, expect, it, vi } from "vitest";
import {
  asList,
  fetchArchiveItem,
  searchArchive,
  guessLang,
  iaDownloadUrl,
  licenseOf,
  normalizeItem,
  parseRuntime,
  sanitizeQuery,
  stripHtml,
  subtitleOptions,
  videoOptions,
  type IaRaw,
} from "@/features/archive/archive.server";
import { archiveSlugify, uniqueSlug } from "@/features/archive/slug";

/** Trimmed to the fields we read, but the shapes match archive.org's real metadata endpoint. */
const featureFilm: IaRaw = {
  server: "ia801606.us.archive.org",
  dir: "/24/items/nosferatu-2000sdvd",
  metadata: {
    identifier: "nosferatu-2000sdvd",
    title: "Nosferatu <b>(1922)</b>",
    year: "1922",
    date: "1922-03-04",
    creator: ["F. W. Murnau", "Henrik Galeen"],
    collection: ["feature_films", "moviesandfilms"],
    description: "<p>A silent horror classic.<br/>Restored transfer.</p><script>alert(1)</script>",
    licenseurl: "http://creativecommons.org/publicdomain/mark/1.0/",
    runtime: "1:34:56",
    downloads: "48213",
  },
  files: [
    { name: "nosferatu-2000sdvd_files.xml", format: "Metadata", size: "1484" },
    { name: "nosferatu-2000sdvd.thumbs/frame_0001.jpg", format: "Thumbnail", size: "10377" },
    { name: "nosferatu-2000sdvd.ogv", format: "Ogg Video", size: "310000000" },
    { name: "nosferatu-2000sdvd.mpg", format: "MPEG1", size: "410000000" },
    {
      name: "nosferatu-2000sdvd_512kb.mp4",
      format: "512Kb MPEG4",
      size: "180000000",
      length: "5696.4",
    },
    { name: "nosferatu-2000sdvd.mp4", format: "h.264", size: "520000000", length: "5696.4" },
    { name: "nosferatu-2000sdvd.m3u8", format: "hls", size: "2000" },
    { name: "nosferatu.en.srt", format: "SubRip", size: "42000" },
    { name: "nosferatu_français.vtt", format: "Web Video Text Tracks", size: "39000" },
    { name: "nosferatu.unknownlang.srt", format: "SubRip", size: "1200" },
  ],
};

describe("archive.org video rendition picker", () => {
  it("prefers HLS, then the small MPEG4 derivative, and ignores unplayable formats", () => {
    const list = videoOptions(featureFilm.files!);
    expect(list.map((f) => f.name)).toEqual([
      "nosferatu-2000sdvd.m3u8",
      "nosferatu-2000sdvd_512kb.mp4",
      "nosferatu-2000sdvd.mp4",
    ]);
    expect(list.every((f) => !/\.(ogv|mpg|avi|mkv)$/i.test(f.name))).toBe(true);
  });

  it("keeps every rendition of a multi-part item so a human can choose", () => {
    const list = videoOptions([
      { name: "serial_part1.mp4", format: "512Kb MPEG4", size: "90000000" },
      { name: "serial_part2.mp4", format: "512Kb MPEG4", size: "88000000" },
    ]);
    expect(list).toHaveLength(2);
    expect(list[0]!.sizeBytes).toBeGreaterThan(list[1]!.sizeBytes);
  });

  it("drops thumbnails, samples and size-less stubs", () => {
    expect(videoOptions([{ name: "poster.mp4", format: "512Kb MPEG4", size: "40000" }])).toEqual(
      [],
    );
    expect(videoOptions([{ name: "clip.webm", format: "WebM", size: "5000000" }])).toHaveLength(1);
  });

  it("reads the runtime from the file when the item has none", () => {
    const item = normalizeItem("x", {
      metadata: { identifier: "x", title: "X" },
      files: [{ name: "x_512kb.mp4", format: "512Kb MPEG4", size: "90000000", length: "3599.9" }],
    });
    expect(item?.durationS).toBe(3600);
  });
});

describe("archive.org licence reporting", () => {
  it("recognises public domain and Creative Commons statements", () => {
    expect(
      licenseOf({ licenseurl: "https://creativecommons.org/publicdomain/mark/1.0/" }),
    ).toMatchObject({ status: "public-domain" });
    expect(licenseOf({ licenseurl: "https://creativecommons.org/licenses/by/4.0/" })).toMatchObject(
      { status: "open", label: "Creative Commons BY 4.0" },
    );
    expect(licenseOf({ rights: "Public Domain, free to use" })).toMatchObject({
      status: "public-domain",
    });
  });

  it("never invents a licence when the item declares none", () => {
    expect(licenseOf({ collection: ["feature_films"] })).toMatchObject({
      status: "unknown",
      url: null,
    });
    expect(licenseOf({}).status).toBe("unknown");
  });
});

describe("archive.org item normalization", () => {
  it("strips markup from the title and synopsis and keeps the declared licence", () => {
    const item = normalizeItem("nosferatu-2000sdvd", featureFilm);
    expect(item?.title).toBe("Nosferatu (1922)");
    expect(item?.description).not.toContain("<");
    expect(item?.description).toContain("silent horror classic");
    expect(item?.year).toBe(1922);
    expect(item?.license.status).toBe("public-domain");
    expect(item?.creators).toEqual(["F. W. Murnau", "Henrik Galeen"]);
    expect(item?.posterUrl).toBe("https://archive.org/services/img/nosferatu-2000sdvd");
    expect(item?.detailUrl).toBe("https://archive.org/details/nosferatu-2000sdvd");
    expect(item?.video?.name).toBe("nosferatu-2000sdvd.m3u8");
  });

  it("refuses items withheld from public view", () => {
    expect(
      normalizeItem("night_of_the_living_dead", {
        is_dark: true,
        metadata: { title: "Night of the Living Dead" },
      }),
    ).toBeNull();
  });

  it("falls back to the identifier when the item has no title", () => {
    expect(normalizeItem("some-item", { metadata: {} })?.title).toBe("some-item");
  });

  it("ignores a nonsensical year", () => {
    expect(normalizeItem("x", { metadata: { title: "X", year: "0" } })?.year).toBeNull();
  });
});

describe("archive.org subtitle tracks", () => {
  it("detects the language from the file name and skips unknown languages", () => {
    expect(guessLang("nosferatu.en.srt")).toEqual({ lang: "en", label: "English" });
    expect(guessLang("pelicula_espanol.vtt")).toEqual({ lang: "es", label: "Español" });
    expect(guessLang("movie.fra.srt")).toMatchObject({ lang: "fr" });
    expect(guessLang("movie.subs.srt")).toBeNull();
  });

  it("returns only valid, language-tagged tracks", () => {
    const subs = subtitleOptions(featureFilm.files!);
    expect(subs.map((s) => s.lang)).toEqual(["en", "fr"]);
    expect(subs.every((s) => s.name.endsWith(".srt") || s.name.endsWith(".vtt"))).toBe(true);
  });

  it("caps a huge subtitle dump instead of importing it whole", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      name: `movie.en.part${i % 2 === 0 ? "" : "b"}.${i}.srt`,
      format: "SubRip",
    }));
    expect(subtitleOptions(many).length).toBeLessThanOrEqual(12);
  });
});

describe("archive.org URLs and query safety", () => {
  it("builds download URLs that survive spaces and subdirectories", () => {
    expect(iaDownloadUrl("my item", "Content/big buck bunny.mp4")).toBe(
      "https://archive.org/download/my%20item/Content/big%20buck%20bunny.mp4",
    );
  });

  it("strips Lucene syntax so admin text cannot break out of its clause", () => {
    expect(sanitizeQuery('title:"Matrix" AND collection:(evil)')).toBe(
      "title Matrix AND collection evil",
    );
    expect(sanitizeQuery("   ")).toBe("");
  });

  it("splits archive.org's scalar, array and comma-joined metadata fields alike", () => {
    expect(asList("a; b, c")).toEqual(["a", "b", "c"]);
    expect(asList(["a", "b"])).toEqual(["a", "b"]);
    expect(asList(1922)).toEqual(["1922"]);
  });

  it("parses runtimes in every shape archive.org uses", () => {
    expect(parseRuntime("1:34:56")).toBe(5696);
    expect(parseRuntime("12:04")).toBe(724);
    expect(parseRuntime("5445.32")).toBe(5445);
    expect(parseRuntime(3600)).toBe(3600);
    expect(parseRuntime("not a time")).toBeNull();
    expect(parseRuntime(undefined)).toBeNull();
  });

  it("degrades description markup to plain text", () => {
    expect(stripHtml("<p>Hello</p><p>World &amp; friends</p>")).toBe("Hello\n\nWorld & friends");
  });
});

describe("archive.org API calls", () => {
  afterEach(() => vi.unstubAllGlobals());

  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

  it("queries the public search endpoint and normalizes the docs it returns", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return json({ response: { docs: [{ identifier: "nosferatu-2000sdvd", title: "Nosferatu", year: "1922", licenseurl: "https://creativecommons.org/publicdomain/mark/1.0/" }] } });
    });
    const rows = await searchArchive({ q: "nosferatu!", collection: "feature_films", rows: 5 });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.identifier).toBe("nosferatu-2000sdvd");
    expect(rows[0]?.license.status).toBe("public-domain");

    const u = new URL(calls[0]!);
    expect(`${u.origin}${u.pathname}`).toBe("https://archive.org/advancedsearch.php");
    const q = u.searchParams.get("q") ?? "";
    expect(q).toContain("mediatype:(movies)");
    expect(q).toContain("collection:(feature_films)");
    expect(q).toContain("NOT is_dark:(true)");
    expect(q).toContain("(nosferatu)"); // the "!" was stripped, so the clause can never be broken into
    expect(u.searchParams.get("output")).toBe("json");
    expect(u.searchParams.get("rows")).toBe("5");
  });

  it("ignores a collection that is not on the allowlist instead of passing it through", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return json({ response: { docs: [] } });
    });
    await searchArchive({ q: "metropolis", collection: "someone-elses-scraper", rows: 3 });
    expect(calls[0]).not.toContain("someone-elses-scraper");
  });

  it("retries a transient archive.org failure instead of surfacing it", async () => {
    let n = 0;
    vi.stubGlobal("fetch", async () => {
      n++;
      return n < 3 ? new Response("boom", { status: 500 }) : json({ response: { docs: [{ identifier: "metropolis-1927", title: "Metropolis" }] } });
    });
    const rows = await searchArchive({ q: "metropolis 1927", rows: 2 });
    expect(n).toBe(3);
    expect(rows[0]?.identifier).toBe("metropolis-1927");
  });

  it("refuses items that archive.org withholds from public view", async () => {
    vi.stubGlobal("fetch", async () => json({ is_dark: true, metadata: { identifier: "hidden-one", title: "Hidden" } }));
    await expect(fetchArchiveItem("hidden-one")).rejects.toThrow(/withheld/i);
  });

  it("reports a missing item once, without hammering archive.org", async () => {
    let n = 0;
    vi.stubGlobal("fetch", async () => {
      n++;
      return new Response("nope", { status: 404 });
    });
    await expect(fetchArchiveItem("does-not-exist-item")).rejects.toThrow(/not found/i);
    expect(n).toBe(1);
  });

  it("rejects identifiers that could be used to reach another host", async () => {
    await expect(fetchArchiveItem("../../etc/passwd")).rejects.toThrow(/identifier/i);
    await expect(fetchArchiveItem("a")).rejects.toThrow(/identifier/i);
  });
});

describe("imported title slugs", () => {
  it("never ends a slug with a number, because that ending belongs to TMDB/AniList ids", () => {
    expect(archiveSlugify("Nosferatu (1922)")).toBe("nosferatu-1922");
    const taken = new Set(["nosferatu-1922"]);
    const slug = uniqueSlug(archiveSlugify("Nosferatu (1922)"), taken);
    expect(slug).toBe("nosferatu-1922-archive");
    expect(/-[0-9]+$/.test(slug)).toBe(false);
  });

  it("keeps resolving collisions with letters", () => {
    const taken = new Set(["metropolis", "metropolis-archive", "metropolis-archive-b"]);
    expect(uniqueSlug("metropolis", taken)).toBe("metropolis-archive-c");
    expect(uniqueSlug("metropolis", new Set())).toBe("metropolis");
  });

  it("produces a valid slug for Arabic-only and numeric titles", () => {
    expect(archiveSlugify("١٩٤٨")).toBe("archive-film");
    expect(archiveSlugify("  Movie: The -- Sequel!  ")).toBe("movie-the-sequel");
    expect(archiveSlugify("")).toBe("archive-film");
  });
});
