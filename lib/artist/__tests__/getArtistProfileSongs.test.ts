import { beforeEach, describe, expect, it, vi } from "vitest";
import { getArtistProfileSongs } from "../getArtistProfileSongs";
import { selectSongArtists } from "@/lib/supabase/song_artists/selectSongArtists";
import { selectSongs } from "@/lib/supabase/songs/selectSongs";
import { selectLatestSongPlays } from "@/lib/songs/selectLatestSongPlays";
import { resolveSongArtwork } from "../resolveSongArtwork";
vi.mock("@/lib/supabase/song_artists/selectSongArtists", () => ({ selectSongArtists: vi.fn() }));
vi.mock("@/lib/supabase/songs/selectSongs", () => ({ selectSongs: vi.fn() }));
vi.mock("@/lib/songs/selectLatestSongPlays", () => ({ selectLatestSongPlays: vi.fn() }));
vi.mock("../resolveSongArtwork", () => ({ resolveSongArtwork: vi.fn() }));
const artistId = "29b29cba-daa0-4a9f-a95e-fb2f74f3a7f6";
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(selectSongArtists).mockResolvedValue([
    { song: "A" },
    { song: "B" },
    { song: "A" },
  ] as never);
  vi.mocked(selectSongs).mockResolvedValue([
    { isrc: "A", name: "Solo", album: null, artwork_url: "https://stored/a.png" },
    { isrc: "B", name: "Shared", album: null, artwork_url: null },
  ] as never);
  vi.mocked(selectLatestSongPlays).mockResolvedValue({ A: 2, B: 9 });
  vi.mocked(resolveSongArtwork).mockResolvedValue({ B: "https://resolved/b.png" });
});
describe("getArtistProfileSongs", () => {
  it("accepts artistId and returns credited recordings without catalog queries", async () => {
    const songs = await getArtistProfileSongs(artistId);
    expect(selectSongArtists).toHaveBeenCalledWith({ artists: [artistId] });
    expect(selectSongs).toHaveBeenCalledWith(["A", "B"]);
    expect(songs.map(s => s.isrc)).toEqual(["B", "A"]);
    expect(songs[0]).toEqual({
      isrc: "B",
      name: "Shared",
      album: null,
      artwork_url: "https://resolved/b.png",
      plays: 9,
      est_value_usd: expect.any(Number),
    });
    expect(resolveSongArtwork).toHaveBeenCalledWith(["B"]);
  });
  it("returns no songs without credits and avoids metadata calls", async () => {
    vi.mocked(selectSongArtists).mockResolvedValue([]);
    expect(await getArtistProfileSongs(artistId)).toEqual([]);
    expect(selectSongs).not.toHaveBeenCalled();
  });
  it("excludes metadata outside the requested artist and deduplicates records", async () => {
    vi.mocked(selectSongs).mockResolvedValue([
      { isrc: "B", name: "Shared" },
      { isrc: "B", name: "Shared" },
      { isrc: "OTHER", name: "Unrelated" },
    ] as never);
    expect((await getArtistProfileSongs(artistId)).map(s => s.isrc)).toEqual(["B"]);
  });
  it("returns unmeasured songs with zero estimates and tolerates missing metadata", async () => {
    vi.mocked(selectLatestSongPlays).mockResolvedValue({});
    vi.mocked(selectSongs).mockResolvedValue([{ isrc: "A", name: "Solo" }] as never);
    expect(await getArtistProfileSongs(artistId)).toEqual([
      { isrc: "A", name: "Solo", album: null, artwork_url: null, plays: 0, est_value_usd: 0 },
    ]);
  });
  it("propagates credit lookup failure so the profile can degrade explicitly", async () => {
    vi.mocked(selectSongArtists).mockRejectedValue(new Error("credits unavailable"));
    await expect(getArtistProfileSongs(artistId)).rejects.toThrow("credits unavailable");
  });
});
