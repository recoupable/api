import { describe, it, expect, vi, beforeEach } from "vitest";

import { linkSongsToArtists } from "../linkSongsToArtists";
import { getPreferredArtistAccountIds } from "@/lib/supabase/songs/getPreferredArtistAccountIds";
import { insertSongArtists } from "@/lib/supabase/song_artists/insertSongArtists";
import { attachSpotifySocialsToArtists } from "../attachSpotifySocialsToArtists";
import type { SongWithSpotify } from "../getSongsByIsrc";

vi.mock("@/lib/supabase/songs/getPreferredArtistAccountIds", () => ({
  getPreferredArtistAccountIds: vi.fn(),
}));
vi.mock("@/lib/supabase/song_artists/insertSongArtists", () => ({ insertSongArtists: vi.fn() }));
vi.mock("../attachSpotifySocialsToArtists", () => ({ attachSpotifySocialsToArtists: vi.fn() }));

const song = (isrc: string, artists: { id: string | null; name: string | null }[]) =>
  ({ isrc, name: isrc, album: null, spotifyArtists: artists }) as SongWithSpotify;

describe("linkSongsToArtists", () => {
  beforeEach(() => vi.clearAllMocks());

  it("links songs to resolved artist accounts", async () => {
    vi.mocked(getPreferredArtistAccountIds).mockResolvedValue(
      new Map([["del water gap", "artist-1"]]),
    );

    await linkSongsToArtists([song("A", [{ id: "spot1", name: "Del Water Gap" }])]);

    expect(insertSongArtists).toHaveBeenCalledWith([{ song: "A", artist: "artist-1" }]);
  });

  it("attaches Spotify socials to the resolved artist accounts (chat#1850 P1 forward fix)", async () => {
    vi.mocked(getPreferredArtistAccountIds).mockResolvedValue(
      new Map([
        ["del water gap", "artist-1"],
        ["claud", "artist-2"],
      ]),
    );

    await linkSongsToArtists([
      song("A", [
        { id: "0xPoVNPnxIIUS1vrxAYV00", name: "Del Water Gap" },
        { id: "claudSpotifyId", name: "Claud" },
      ]),
    ]);

    expect(attachSpotifySocialsToArtists).toHaveBeenCalledWith(
      expect.arrayContaining([
        { artistAccountId: "artist-1", spotifyArtistId: "0xPoVNPnxIIUS1vrxAYV00" },
        { artistAccountId: "artist-2", spotifyArtistId: "claudSpotifyId" },
      ]),
    );
  });

  it("omits artists without a Spotify id from the socials attach", async () => {
    vi.mocked(getPreferredArtistAccountIds).mockResolvedValue(
      new Map([["del water gap", "artist-1"]]),
    );

    await linkSongsToArtists([song("A", [{ id: null, name: "Del Water Gap" }])]);

    expect(attachSpotifySocialsToArtists).toHaveBeenCalledWith([]);
  });

  it("does nothing when songs carry no artist names", async () => {
    await linkSongsToArtists([song("A", [{ id: "x", name: null }])]);

    expect(getPreferredArtistAccountIds).not.toHaveBeenCalled();
    expect(insertSongArtists).not.toHaveBeenCalled();
    expect(attachSpotifySocialsToArtists).not.toHaveBeenCalled();
  });
});
