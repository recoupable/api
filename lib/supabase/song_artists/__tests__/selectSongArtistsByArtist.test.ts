import { describe, it, expect, vi, beforeEach } from "vitest";

import { selectSongArtistsByArtist } from "../selectSongArtistsByArtist";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe("selectSongArtistsByArtist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
  });

  it("returns the song_artists rows for the artist", async () => {
    const rows = [{ id: "sa-1", song: "ISRC1", artist: "artist-1" }];
    mockEq.mockResolvedValue({ data: rows, error: null });

    const result = await selectSongArtistsByArtist("artist-1");

    expect(mockFrom).toHaveBeenCalledWith("song_artists");
    expect(mockEq).toHaveBeenCalledWith("artist", "artist-1");
    expect(result).toEqual(rows);
  });

  it("returns an empty array when no rows match", async () => {
    mockEq.mockResolvedValue({ data: [], error: null });

    const result = await selectSongArtistsByArtist("artist-1");

    expect(result).toEqual([]);
  });

  it("returns null on query error (callers decide how to treat an unknown state)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockEq.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await selectSongArtistsByArtist("artist-1");

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
