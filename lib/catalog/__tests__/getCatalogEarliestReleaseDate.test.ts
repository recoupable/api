import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCatalogEarliestReleaseDate } from "../getCatalogEarliestReleaseDate";
import { selectPlaycountSnapshots } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getAlbums from "@/lib/spotify/getAlbums";

vi.mock("@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots", () => ({
  selectPlaycountSnapshots: vi.fn(),
}));
vi.mock("@/lib/spotify/generateAccessToken", () => ({ default: vi.fn() }));
vi.mock("@/lib/spotify/getAlbums", () => ({ default: vi.fn() }));

const snapshot = (albumIds: string[] | null) => ({ id: "snap_1", album_ids: albumIds });

describe("getCatalogEarliestReleaseDate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the earliest release date across the source run's albums", async () => {
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([snapshot(["a1", "a2"])] as never);
    vi.mocked(generateAccessToken).mockResolvedValue({ access_token: "tok" } as never);
    vi.mocked(getAlbums).mockResolvedValue({
      albums: [
        { id: "a1", release_date: "2019-03-01" },
        { id: "a2", release_date: "2015-06-12" },
      ],
      error: null,
    });

    const result = await getCatalogEarliestReleaseDate("cat_1");

    expect(selectPlaycountSnapshots).toHaveBeenCalledWith({ catalog: "cat_1" });
    expect(getAlbums).toHaveBeenCalledWith({ ids: ["a1", "a2"], accessToken: "tok" });
    expect(result).toBe("2015-06-12");
  });

  it("uses the newest snapshot that has album ids", async () => {
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([
      snapshot(null),
      snapshot(["a1"]),
    ] as never);
    vi.mocked(generateAccessToken).mockResolvedValue({ access_token: "tok" } as never);
    vi.mocked(getAlbums).mockResolvedValue({
      albums: [{ id: "a1", release_date: "2021-01-01" }],
      error: null,
    });

    expect(await getCatalogEarliestReleaseDate("cat_1")).toBe("2021-01-01");
  });

  it("returns null when no snapshot has album ids", async () => {
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([snapshot(null)] as never);

    expect(await getCatalogEarliestReleaseDate("cat_1")).toBeNull();
    expect(generateAccessToken).not.toHaveBeenCalled();
  });

  it("returns null when the Spotify token cannot be generated", async () => {
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([snapshot(["a1"])] as never);
    vi.mocked(generateAccessToken).mockResolvedValue({
      access_token: null,
      error: new Error("nope"),
    } as never);

    expect(await getCatalogEarliestReleaseDate("cat_1")).toBeNull();
  });

  it("returns null when the albums fetch fails", async () => {
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([snapshot(["a1"])] as never);
    vi.mocked(generateAccessToken).mockResolvedValue({ access_token: "tok" } as never);
    vi.mocked(getAlbums).mockResolvedValue({ albums: null, error: new Error("boom") });

    expect(await getCatalogEarliestReleaseDate("cat_1")).toBeNull();
  });
});
