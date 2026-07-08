import { describe, it, expect, vi, beforeEach } from "vitest";

import { getSongArtistExistsByArtist } from "../getSongArtistExistsByArtist";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe("getSongArtistExistsByArtist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
  });

  it("returns true when song_artists rows exist for the artist", async () => {
    mockEq.mockResolvedValue({ count: 3, error: null });

    const result = await getSongArtistExistsByArtist("artist-1");

    expect(mockFrom).toHaveBeenCalledWith("song_artists");
    expect(mockEq).toHaveBeenCalledWith("artist", "artist-1");
    expect(result).toBe(true);
  });

  it("returns false when no song_artists rows exist", async () => {
    mockEq.mockResolvedValue({ count: 0, error: null });

    const result = await getSongArtistExistsByArtist("artist-1");

    expect(result).toBe(false);
  });

  it("fails safe by returning true on query error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockEq.mockResolvedValue({ count: null, error: { message: "boom" } });

    const result = await getSongArtistExistsByArtist("artist-1");

    expect(result).toBe(true);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
