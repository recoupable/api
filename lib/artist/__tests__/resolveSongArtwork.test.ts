import { describe, it, expect, vi, beforeEach } from "vitest";

const { getAppleSongsByIsrcMock, updateSongMock } = vi.hoisted(() => ({
  getAppleSongsByIsrcMock: vi.fn(),
  updateSongMock: vi.fn(),
}));

vi.mock("@/lib/apple/getAppleSongsByIsrc", () => ({
  getAppleSongsByIsrc: getAppleSongsByIsrcMock,
}));
vi.mock("@/lib/supabase/songs/updateSong", () => ({
  updateSong: updateSongMock,
}));

const { resolveSongArtwork } = await import("@/lib/artist/resolveSongArtwork");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  updateSongMock.mockResolvedValue(undefined);
});

describe("resolveSongArtwork", () => {
  // Apple returns artwork as a {w}x{h} template; the stored and served URL
  // must be directly fetchable, so the template resolves before write-through.
  it("resolves Apple's size template and writes the fetchable URL through", async () => {
    getAppleSongsByIsrcMock.mockResolvedValue({
      results: [
        {
          isrc: "ISRC1",
          found: true,
          songs: [{ isrc: "ISRC1", artwork_url: "https://a/1.jpg/{w}x{h}bb.jpg" }],
        },
        { isrc: "ISRC2", found: false, songs: [] },
      ],
      error: null,
    });

    const art = await resolveSongArtwork(["ISRC1", "ISRC2"]);

    expect(art).toEqual({ ISRC1: "https://a/1.jpg/296x296bb.jpg" });
    expect(getAppleSongsByIsrcMock).toHaveBeenCalledWith({
      isrcs: ["ISRC1", "ISRC2"],
      storefront: "us",
    });
    expect(updateSongMock).toHaveBeenCalledWith("ISRC1", {
      artwork_url: "https://a/1.jpg/296x296bb.jpg",
    });
  });

  // Apple is a third party on a public path: its failure yields no artwork,
  // never a failed profile.
  it("returns {} when Apple errors, without writing anything", async () => {
    getAppleSongsByIsrcMock.mockResolvedValue({ results: null, error: new Error("apple down") });

    expect(await resolveSongArtwork(["ISRC1"])).toEqual({});
    expect(updateSongMock).not.toHaveBeenCalled();
  });

  it("returns {} for no ISRCs without calling Apple", async () => {
    expect(await resolveSongArtwork([])).toEqual({});
    expect(getAppleSongsByIsrcMock).not.toHaveBeenCalled();
  });

  it("survives a write-through failure and still returns the artwork", async () => {
    getAppleSongsByIsrcMock.mockResolvedValue({
      results: [
        { isrc: "ISRC1", found: true, songs: [{ isrc: "ISRC1", artwork_url: "https://a/1.jpg" }] },
      ],
      error: null,
    });
    updateSongMock.mockRejectedValue(new Error("db write failed"));

    expect(await resolveSongArtwork(["ISRC1"])).toEqual({ ISRC1: "https://a/1.jpg" });
  });
});
