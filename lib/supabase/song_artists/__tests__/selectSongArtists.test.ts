import { describe, it, expect, vi, beforeEach } from "vitest";

import { selectSongArtists } from "../selectSongArtists";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockIn = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe("selectSongArtists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ in: mockIn });
  });

  it("filters by song ISRCs", async () => {
    const rows = [{ id: "sa-1", song: "ISRC1", artist: "artist-1" }];
    mockIn.mockResolvedValue({ data: rows, error: null });

    const result = await selectSongArtists({ songs: ["ISRC1"] });

    expect(mockFrom).toHaveBeenCalledWith("song_artists");
    expect(mockIn).toHaveBeenCalledWith("song", ["ISRC1"]);
    expect(result).toEqual(rows);
  });

  it("filters by artist account IDs", async () => {
    const rows = [{ id: "sa-1", song: "ISRC1", artist: "artist-1" }];
    mockIn.mockResolvedValue({ data: rows, error: null });

    const result = await selectSongArtists({ artists: ["artist-1"] });

    expect(mockIn).toHaveBeenCalledWith("artist", ["artist-1"]);
    expect(result).toEqual(rows);
  });

  it("returns an empty array without querying when the filter list is empty", async () => {
    const result = await selectSongArtists({ artists: [] });

    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("chunks large filter lists to keep .in() within URL limits", async () => {
    mockIn.mockResolvedValue({ data: [], error: null });
    const songs = Array.from({ length: 450 }, (_, i) => `ISRC${i}`);

    await selectSongArtists({ songs });

    // 450 / 200 => 3 chunks
    expect(mockIn).toHaveBeenCalledTimes(3);
  });

  it("returns null on query error (callers decide how to treat an unknown state)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockIn.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await selectSongArtists({ artists: ["artist-1"] });

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("throws when neither songs nor artists is provided", async () => {
    await expect(selectSongArtists({})).rejects.toThrow("Must provide either songs or artists");
  });
});
