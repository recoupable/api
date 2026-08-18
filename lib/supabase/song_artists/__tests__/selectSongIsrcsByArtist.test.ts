import { describe, it, expect, vi, beforeEach } from "vitest";

const { fromMock, selectMock, eqMock } = vi.hoisted(() => {
  const eqMock = vi.fn();
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));
  return { fromMock, selectMock, eqMock };
});

vi.mock("../../serverClient", () => ({ default: { from: fromMock } }));

const { selectSongIsrcsByArtist } = await import(
  "@/lib/supabase/song_artists/selectSongIsrcsByArtist"
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("selectSongIsrcsByArtist", () => {
  it("returns distinct ISRCs crediting the artist", async () => {
    eqMock.mockResolvedValue({
      data: [{ song: "ISRC1" }, { song: "ISRC2" }, { song: "ISRC1" }],
      error: null,
    });

    expect(await selectSongIsrcsByArtist("artist-1")).toEqual(["ISRC1", "ISRC2"]);
    expect(fromMock).toHaveBeenCalledWith("song_artists");
    expect(selectMock).toHaveBeenCalledWith("song");
    expect(eqMock).toHaveBeenCalledWith("artist", "artist-1");
  });

  it("returns [] on error rather than failing the profile", async () => {
    eqMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    expect(await selectSongIsrcsByArtist("artist-1")).toEqual([]);
  });
});
