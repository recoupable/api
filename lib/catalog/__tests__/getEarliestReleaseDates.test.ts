import { describe, it, expect, vi, beforeEach } from "vitest";

import { getEarliestReleaseDates } from "../getEarliestReleaseDates";
import { selectPlaycountSnapshots } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getAlbums from "@/lib/spotify/getAlbums";

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

describe("getEarliestReleaseDates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an empty map without querying for no catalogs", async () => {
    const result = await getEarliestReleaseDates([]);

    expect(result.size).toBe(0);
    expect(selectPlaycountSnapshots).not.toHaveBeenCalled();
  });

  it("reads every catalog's album ids in one query and asks Spotify for the union", async () => {
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

    await getEarliestReleaseDates([catalogA, catalogB]);

    expect(selectPlaycountSnapshots).toHaveBeenCalledTimes(1);
    expect(selectPlaycountSnapshots).toHaveBeenCalledWith({ catalogs: [catalogA, catalogB] });
    // "album-2" is shared and must not be fetched twice.
    expect(getAlbums).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getAlbums).mock.calls[0][0].ids).toEqual(["album-1", "album-2", "album-3"]);
  });

  it("gives each catalog the earliest date among its own albums", async () => {
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([
      snapshot(catalogA, ["album-1", "album-2"]),
      snapshot(catalogB, ["album-3"]),
    ]);
    okToken();
    vi.mocked(getAlbums).mockResolvedValue({
      albums: [
        { id: "album-1", release_date: "2015-01-01" },
        { id: "album-2", release_date: "2018-01-01" },
        { id: "album-3", release_date: "2024-01-01" },
      ],
      error: null,
    });

    const result = await getEarliestReleaseDates([catalogA, catalogB]);

    expect(result.get(catalogA)).toBe("2015-01-01");
    expect(result.get(catalogB)).toBe("2024-01-01");
  });

  it("chunks the catalog ids so one query can't outgrow the URL limit", async () => {
    const catalogIds = Array.from({ length: 120 }, (_, index) => `catalog-${index}`);
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([]);

    await getEarliestReleaseDates(catalogIds);

    expect(selectPlaycountSnapshots).toHaveBeenCalledTimes(3);
    expect(
      vi.mocked(selectPlaycountSnapshots).mock.calls.map(call => call[0].catalogs?.length),
    ).toEqual([50, 50, 20]);
  });

  it("splits a large album set into batches of 20", async () => {
    const albumIds = Array.from({ length: 45 }, (_, index) => `album-${index}`);
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([snapshot(catalogA, albumIds)]);
    okToken();
    vi.mocked(getAlbums).mockImplementation(async ({ ids }) => ({
      albums: ids.map(id => ({ id, release_date: "2020-01-01" })),
      error: null,
    }));

    await getEarliestReleaseDates([catalogA]);

    // getAlbums walks its own batches sequentially, so the chunking has to
    // happen here for the requests to overlap.
    expect(getAlbums).toHaveBeenCalledTimes(3);
    expect(vi.mocked(getAlbums).mock.calls.map(call => call[0].ids.length)).toEqual([20, 20, 5]);
  });

  it("keeps the dates a failed batch did not cover", async () => {
    const albumIds = Array.from({ length: 25 }, (_, index) => `album-${index}`);
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([snapshot(catalogA, albumIds)]);
    okToken();
    vi.mocked(getAlbums).mockImplementation(async ({ ids }) =>
      ids.length === 20
        ? { albums: null, error: new Error("Spotify API request failed") }
        : { albums: ids.map(id => ({ id, release_date: "2001-01-01" })), error: null },
    );

    const result = await getEarliestReleaseDates([catalogA]);

    expect(result.get(catalogA)).toBe("2001-01-01");
  });

  it("returns nothing when Spotify is unavailable, leaving callers on the default age", async () => {
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([snapshot(catalogA, ["album-1"])]);
    vi.mocked(generateAccessToken).mockResolvedValue(
      {} as Awaited<ReturnType<typeof generateAccessToken>>,
    );

    const result = await getEarliestReleaseDates([catalogA]);

    expect(getAlbums).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
  });

  it("skips a catalog whose snapshots carry no album ids", async () => {
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([snapshot(catalogA, null)]);
    okToken();

    const result = await getEarliestReleaseDates([catalogA]);

    expect(result.has(catalogA)).toBe(false);
    expect(getAlbums).not.toHaveBeenCalled();
  });
});
