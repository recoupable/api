import { describe, it, expect, vi, beforeEach } from "vitest";

import { selectSongArtistsBySongs } from "../selectSongArtistsBySongs";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockIn = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const row = (song: string, artist: string) => ({ id: `${song}-${artist}`, song, artist });

describe("selectSongArtistsBySongs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ in: mockIn });
  });

  it("returns [] without querying when no songs are given", async () => {
    const result = await selectSongArtistsBySongs([]);

    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("selects song_artists rows for the given ISRCs", async () => {
    mockIn.mockResolvedValue({ data: [row("A", "artist-1"), row("B", "artist-1")], error: null });

    const result = await selectSongArtistsBySongs(["A", "B"]);

    expect(mockFrom).toHaveBeenCalledWith("song_artists");
    expect(mockIn).toHaveBeenCalledWith("song", ["A", "B"]);
    expect(result).toHaveLength(2);
  });

  it("chunks large ISRC batches to keep the PostgREST filter bounded", async () => {
    const songs = Array.from({ length: 450 }, (_, i) => `ISRC${i}`);
    mockIn.mockResolvedValue({ data: [row("ISRC0", "artist-1")], error: null });

    await selectSongArtistsBySongs(songs);

    expect(mockIn).toHaveBeenCalledTimes(3); // 200 + 200 + 50
    expect(mockIn.mock.calls[0][1]).toHaveLength(200);
    expect(mockIn.mock.calls[2][1]).toHaveLength(50);
  });

  it("returns [] and logs on query error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockIn.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await selectSongArtistsBySongs(["A"]);

    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
