import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateObject } from "ai";
import { selectCatalogSongsWithArtists } from "@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists";
import type { CatalogSongWithArtists } from "@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists";
import { analyzeFullCatalog } from "../analyzeFullCatalog";

vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@/lib/const", () => ({ DEFAULT_MODEL: "test-model" }));
vi.mock("@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists", () => ({
  selectCatalogSongsWithArtists: vi.fn(),
}));

const criteria = "Halloween workout songs";
const options = { catalogId: "catalog", criteria };

function catalog(size: number) {
  const songs: CatalogSongWithArtists[] = Array.from({ length: size }, (_, index) => ({
    catalog_id: "catalog",
    isrc: `ISRC${index}`,
    name: `Song ${index}`,
    album: null,
    artwork_url: null,
    notes: null,
    updated_at: "2026-09-19T00:00:00Z",
    artists: [],
  }));
  vi.mocked(selectCatalogSongsWithArtists).mockImplementation(
    async ({ page = 1, limit = 100 }) => ({
      songs: songs.slice((page - 1) * limit, page * limit),
      total_count: songs.length,
    }),
  );
  return songs;
}

function select(isrcs: string[]) {
  vi.mocked(generateObject).mockResolvedValue({
    object: { selected_song_isrcs: isrcs },
  } as Awaited<ReturnType<typeof generateObject>>);
}

describe("analyzeFullCatalog filtering", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns an empty catalog without inference", async () => {
    catalog(0);
    expect(await analyzeFullCatalog(options)).toEqual({
      results: [],
      totalSongs: 0,
      totalPages: 0,
    });
    expect(generateObject).not.toHaveBeenCalled();
  });

  it.each([1, 500, 1000])("applies criteria to a %i-song catalog", async size => {
    const songs = catalog(size);
    select([songs[size - 1].isrc]);
    const result = await analyzeFullCatalog(options);
    expect(result.results).toEqual([songs[size - 1]]);
    expect(result.totalSongs).toBe(size);
    expect(result.totalPages).toBe(Math.ceil(size / 100));
    expect(generateObject).toHaveBeenCalledTimes(Math.ceil(size / 100));
    for (const [request] of vi.mocked(generateObject).mock.calls) {
      expect(request.prompt).toContain(criteria);
    }
  });

  it("returns no results when no songs match", async () => {
    catalog(5);
    select([]);
    expect((await analyzeFullCatalog(options)).results).toEqual([]);
  });

  it("filters before limiting, so a match on the last page is retained", async () => {
    const songs = catalog(1001);
    select([songs[1000].isrc]);
    expect((await analyzeFullCatalog(options)).results).toEqual([songs[1000]]);
    expect(generateObject).toHaveBeenCalledTimes(11);
  });

  it("caps all-matching results without reprocessing batches", async () => {
    const songs = catalog(1001);
    const isrcs = songs.map(song => song.isrc);
    let calls = 0;
    vi.mocked(generateObject).mockImplementation(async () => {
      // Fail quickly on the old recursion instead of hanging the test runner.
      if (++calls > 11) throw new Error("Catalog was analyzed more than once");
      return { object: { selected_song_isrcs: isrcs } } as Awaited<
        ReturnType<typeof generateObject>
      >;
    });
    expect(await analyzeFullCatalog(options)).toEqual({
      results: songs.slice(0, 1000),
      totalSongs: 1001,
      totalPages: 11,
    });
    expect(generateObject).toHaveBeenCalledTimes(11);
  });

  it("ignores invented identifiers and duplicate model selections", async () => {
    const songs = catalog(2);
    select([songs[1].isrc, "not-in-catalog", songs[1].isrc]);
    expect((await analyzeFullCatalog(options)).results).toEqual([songs[1]]);
  });

  it("propagates inference failure instead of returning unfiltered songs", async () => {
    catalog(1);
    vi.mocked(generateObject).mockRejectedValue(new Error("Model unavailable"));
    await expect(analyzeFullCatalog(options)).rejects.toThrow("Model unavailable");
  });
});
