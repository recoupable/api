import { describe, it, expect, vi, beforeEach } from "vitest";

import { getCatalogValuations } from "../getCatalogValuations";
import { selectCatalogMeasurementsAggregate } from "@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate";
import { selectPlaycountSnapshots } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getAlbums from "@/lib/spotify/getAlbums";
import { computeValuationBand } from "../computeValuationBand";

vi.mock("@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate", () => ({
  selectCatalogMeasurementsAggregate: vi.fn(),
}));
vi.mock("@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots", () => ({
  selectPlaycountSnapshots: vi.fn(),
}));
vi.mock("@/lib/spotify/generateAccessToken", () => ({ default: vi.fn() }));
vi.mock("@/lib/spotify/getAlbums", () => ({ default: vi.fn() }));

const catalogA = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const catalogB = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";

const snapshot = (catalog: string, albumIds: string[] | null) => ({
  id: `snap-${catalog}`,
  account: "acc",
  album_count: albumIds?.length ?? 0,
  album_ids: albumIds,
  catalog,
  created_at: "2026-08-06T00:00:00Z",
  estimated_cost_usd: 0,
  isrcs: null,
  platforms: ["spotify"],
  schedule: "once",
  state: "done",
  updated_at: "2026-08-06T00:00:00Z",
});

const okToken = () =>
  vi
    .mocked(generateAccessToken)
    .mockResolvedValue({ access_token: "t" } as Awaited<ReturnType<typeof generateAccessToken>>);

describe("getCatalogValuations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an empty map without querying for no catalogs", async () => {
    const result = await getCatalogValuations([]);

    expect(result.size).toBe(0);
    expect(selectCatalogMeasurementsAggregate).not.toHaveBeenCalled();
    expect(selectPlaycountSnapshots).not.toHaveBeenCalled();
  });

  it("values a measured catalog with the same model as the report", async () => {
    vi.mocked(selectCatalogMeasurementsAggregate).mockResolvedValue({
      measuredSongCount: 26,
      totalStreams: 7676,
    });
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([snapshot(catalogA, ["album-1"])]);
    okToken();
    vi.mocked(getAlbums).mockResolvedValue({
      albums: [{ id: "album-1", release_date: "2020-01-01" }],
      error: null,
    });

    const result = await getCatalogValuations([catalogA]);
    const expected = computeValuationBand({
      totalStreams: 7676,
      earliestReleaseDate: "2020-01-01",
    }).valuation;

    expect(result.get(catalogA)).toEqual({ measuredSongCount: 26, valuation: expected });
  });

  it("reports a null valuation for a catalog with nothing measured", async () => {
    vi.mocked(selectCatalogMeasurementsAggregate).mockResolvedValue({
      measuredSongCount: 0,
      totalStreams: 0,
    });
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([]);
    okToken();

    const result = await getCatalogValuations([catalogA]);

    expect(result.get(catalogA)).toEqual({ measuredSongCount: 0, valuation: null });
  });

  it("asks Spotify for the union of album ids, not once per catalog", async () => {
    vi.mocked(selectCatalogMeasurementsAggregate).mockResolvedValue({
      measuredSongCount: 5,
      totalStreams: 1000,
    });
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([
      snapshot(catalogA, ["album-1", "album-2"]),
      snapshot(catalogB, ["album-2", "album-3"]),
    ]);
    okToken();
    vi.mocked(getAlbums).mockResolvedValue({
      albums: [
        { id: "album-1", release_date: "2021-05-05" },
        { id: "album-2", release_date: "2019-02-02" },
        { id: "album-3", release_date: "2023-09-09" },
      ],
      error: null,
    });

    await getCatalogValuations([catalogA, catalogB]);

    expect(selectPlaycountSnapshots).toHaveBeenCalledTimes(1);
    expect(selectPlaycountSnapshots).toHaveBeenCalledWith({ catalogs: [catalogA, catalogB] });
    // 3 deduped ids, one batch — "album-2" is shared and must not be fetched twice.
    expect(getAlbums).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getAlbums).mock.calls[0][0].ids).toEqual(["album-1", "album-2", "album-3"]);
  });

  it("splits a large album set into concurrent batches of 20", async () => {
    const albumIds = Array.from({ length: 45 }, (_, index) => `album-${index}`);
    vi.mocked(selectCatalogMeasurementsAggregate).mockResolvedValue({
      measuredSongCount: 5,
      totalStreams: 1000,
    });
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([snapshot(catalogA, albumIds)]);
    okToken();
    vi.mocked(getAlbums).mockImplementation(async ({ ids }) => ({
      albums: ids.map(id => ({ id, release_date: "2020-01-01" })),
      error: null,
    }));

    await getCatalogValuations([catalogA]);

    // 45 ids -> 20 + 20 + 5. getAlbums walks its own batches sequentially, so
    // the chunking has to happen here for the requests to overlap.
    expect(getAlbums).toHaveBeenCalledTimes(3);
    expect(vi.mocked(getAlbums).mock.calls.map(call => call[0].ids.length)).toEqual([20, 20, 5]);
  });

  it("keeps valuing the catalogs a failed batch did not cover", async () => {
    const albumIds = Array.from({ length: 25 }, (_, index) => `album-${index}`);
    vi.mocked(selectCatalogMeasurementsAggregate).mockResolvedValue({
      measuredSongCount: 5,
      totalStreams: 1000,
    });
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([snapshot(catalogA, albumIds)]);
    okToken();
    vi.mocked(getAlbums).mockImplementation(async ({ ids }) =>
      ids.length === 20
        ? { albums: null, error: new Error("Spotify API request failed") }
        : { albums: ids.map(id => ({ id, release_date: "2001-01-01" })), error: null },
    );

    const result = await getCatalogValuations([catalogA]);

    // The surviving batch still dates the catalog — a partial Spotify failure
    // must not drop the valuation.
    const expected = computeValuationBand({
      totalStreams: 1000,
      earliestReleaseDate: "2001-01-01",
    }).valuation;
    expect(result.get(catalogA)?.valuation).toEqual(expected);
  });

  it("uses each catalog's own earliest release date", async () => {
    vi.mocked(selectCatalogMeasurementsAggregate).mockResolvedValue({
      measuredSongCount: 5,
      totalStreams: 1000,
    });
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([
      snapshot(catalogA, ["album-1"]),
      snapshot(catalogB, ["album-3"]),
    ]);
    okToken();
    vi.mocked(getAlbums).mockResolvedValue({
      albums: [
        { id: "album-1", release_date: "2015-01-01" },
        { id: "album-3", release_date: "2024-01-01" },
      ],
      error: null,
    });

    const result = await getCatalogValuations([catalogA, catalogB]);

    const older = computeValuationBand({
      totalStreams: 1000,
      earliestReleaseDate: "2015-01-01",
    }).valuation;
    const newer = computeValuationBand({
      totalStreams: 1000,
      earliestReleaseDate: "2024-01-01",
    }).valuation;

    expect(result.get(catalogA)?.valuation).toEqual(older);
    expect(result.get(catalogB)?.valuation).toEqual(newer);
    expect(older.mid).not.toEqual(newer.mid);
  });

  it("still values the catalog when Spotify is unavailable, using the default age", async () => {
    vi.mocked(selectCatalogMeasurementsAggregate).mockResolvedValue({
      measuredSongCount: 5,
      totalStreams: 1000,
    });
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([snapshot(catalogA, ["album-1"])]);
    vi.mocked(generateAccessToken).mockResolvedValue(
      {} as Awaited<ReturnType<typeof generateAccessToken>>,
    );

    const result = await getCatalogValuations([catalogA]);
    const fallback = computeValuationBand({
      totalStreams: 1000,
      earliestReleaseDate: null,
    }).valuation;

    expect(getAlbums).not.toHaveBeenCalled();
    expect(result.get(catalogA)?.valuation).toEqual(fallback);
  });

  it("retries a failed aggregate before calling a catalog unmeasured", async () => {
    vi.mocked(selectCatalogMeasurementsAggregate)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ measuredSongCount: 26, totalStreams: 7676 });
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([]);
    okToken();

    const result = await getCatalogValuations([catalogA]);

    // A transient RPC failure must not be published as "not measured" — caught
    // live on a 9,939-song catalog that reported null once and $88.9M next.
    expect(selectCatalogMeasurementsAggregate).toHaveBeenCalledTimes(2);
    expect(result.get(catalogA)?.measuredSongCount).toBe(26);
    expect(result.get(catalogA)?.valuation).not.toBeNull();
  });

  it("treats a twice-failed aggregate as unmeasured rather than throwing", async () => {
    vi.mocked(selectCatalogMeasurementsAggregate).mockResolvedValue(null);
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([]);
    okToken();

    const result = await getCatalogValuations([catalogA]);

    expect(selectCatalogMeasurementsAggregate).toHaveBeenCalledTimes(2);
    expect(result.get(catalogA)).toEqual({ measuredSongCount: 0, valuation: null });
  });
});
