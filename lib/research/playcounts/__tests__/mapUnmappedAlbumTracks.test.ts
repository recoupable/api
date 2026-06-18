import { describe, it, expect, vi, beforeEach } from "vitest";
import { mapUnmappedAlbumTracks } from "../mapUnmappedAlbumTracks";

import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getTracks from "@/lib/spotify/getTracks";
import { upsertSongs } from "@/lib/supabase/songs/upsertSongs";
import { upsertSongIdentifiers } from "@/lib/supabase/song_identifiers/upsertSongIdentifiers";
import { linkSongsToArtists } from "@/lib/songs/linkSongsToArtists";
import { queueRedisSongs } from "@/lib/songs/queueRedisSongs";
import { SpotifyRateLimitError } from "@/lib/spotify/SpotifyRateLimitError";

vi.mock("@/lib/spotify/generateAccessToken", () => ({ default: vi.fn() }));
vi.mock("@/lib/spotify/getTracks", () => ({ default: vi.fn() }));
vi.mock("@/lib/supabase/songs/upsertSongs", () => ({ upsertSongs: vi.fn() }));
vi.mock("@/lib/supabase/song_identifiers/upsertSongIdentifiers", () => ({
  upsertSongIdentifiers: vi.fn(),
}));
vi.mock("@/lib/songs/linkSongsToArtists", () => ({ linkSongsToArtists: vi.fn() }));
vi.mock("@/lib/songs/queueRedisSongs", () => ({ queueRedisSongs: vi.fn() }));

const ALBUMS = [
  {
    id: "album_1",
    name: "K.I.D.S. (Deluxe)",
    tracks: [
      { id: "t_mapped", name: "The Spins", streamCount: 1 },
      { id: "t_new", name: "Nikes on My Feet", streamCount: 2 },
      { id: "t_noisrc", name: "Interlude", streamCount: 3 },
    ],
  },
];

describe("mapUnmappedAlbumTracks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateAccessToken).mockResolvedValue({ access_token: "tok" } as never);
    vi.mocked(upsertSongs).mockResolvedValue([] as never);
  });

  it("resolves ISRCs for unmapped tracks, upserts songs + identifiers, returns new mappings", async () => {
    vi.mocked(getTracks).mockResolvedValue({
      tracks: [
        { id: "t_new", name: "Nikes on My Feet", external_ids: { isrc: "ISRC_NIKES" } },
        { id: "t_noisrc", name: "Interlude", external_ids: {} },
      ],
      error: null,
    } as never);

    const mapped = await mapUnmappedAlbumTracks(ALBUMS, new Set(["t_mapped"]));

    expect(getTracks).toHaveBeenCalledWith({ ids: ["t_new", "t_noisrc"], accessToken: "tok" });
    expect(upsertSongs).toHaveBeenCalledWith([
      { isrc: "ISRC_NIKES", name: "Nikes on My Feet", album: "K.I.D.S. (Deluxe)" },
    ]);
    expect(upsertSongIdentifiers).toHaveBeenCalledWith([
      { song: "ISRC_NIKES", platform: "spotify", identifier_type: "track_id", value: "t_new" },
      { song: "ISRC_NIKES", platform: "spotify", identifier_type: "album_id", value: "album_1" },
    ]);
    expect([...mapped.entries()]).toEqual([["t_new", "ISRC_NIKES"]]);
  });

  it("links captured songs to their Spotify artists and queues them for note enrichment", async () => {
    vi.mocked(getTracks).mockResolvedValue({
      tracks: [
        {
          id: "t_new",
          name: "Nikes on My Feet",
          external_ids: { isrc: "ISRC_NIKES" },
          artists: [{ id: "a1", name: "Mac Miller" }],
        },
      ],
      error: null,
    } as never);

    await mapUnmappedAlbumTracks(ALBUMS, new Set(["t_mapped", "t_noisrc"]));

    // Root-cause fix: captured songs get the same enrichment as the manual flow —
    // artists linked + queued for notes — so they aren't "missing info" in the catalog.
    expect(linkSongsToArtists).toHaveBeenCalledWith([
      expect.objectContaining({
        isrc: "ISRC_NIKES",
        spotifyArtists: [{ id: "a1", name: "Mac Miller" }],
      }),
    ]);
    expect(queueRedisSongs).toHaveBeenCalledWith([expect.objectContaining({ isrc: "ISRC_NIKES" })]);
  });

  it("returns an empty map without Spotify calls when everything is mapped", async () => {
    const mapped = await mapUnmappedAlbumTracks(ALBUMS, new Set(["t_mapped", "t_new", "t_noisrc"]));

    expect(generateAccessToken).not.toHaveBeenCalled();
    expect(mapped.size).toBe(0);
  });

  it("dedupes songs by ISRC across albums (reissues share recordings) before upserting", async () => {
    const twoAlbums = [
      { id: "album_std", name: "Album", tracks: [{ id: "t_std", name: "Song", streamCount: 1 }] },
      {
        id: "album_dlx",
        name: "Album (Deluxe)",
        tracks: [{ id: "t_dlx", name: "Song", streamCount: 1 }],
      },
    ];
    vi.mocked(getTracks).mockResolvedValue({
      tracks: [
        { id: "t_std", name: "Song", external_ids: { isrc: "SAME_ISRC" } },
        { id: "t_dlx", name: "Song", external_ids: { isrc: "SAME_ISRC" } },
      ],
      error: null,
    } as never);

    const mapped = await mapUnmappedAlbumTracks(twoAlbums, new Set());

    // one songs row (DO UPDATE chokes on in-batch duplicates), both track mappings
    expect(vi.mocked(upsertSongs).mock.calls[0][0]).toHaveLength(1);
    const idRows = vi.mocked(upsertSongIdentifiers).mock.calls[0][0];
    expect(
      idRows.filter((r: { identifier_type: string }) => r.identifier_type === "track_id"),
    ).toHaveLength(2);
    expect(mapped.size).toBe(2);
  });

  it("rethrows sustained rate limiting so workflow steps can escalate durably", async () => {
    vi.mocked(getTracks).mockRejectedValue(new SpotifyRateLimitError());

    await expect(mapUnmappedAlbumTracks(ALBUMS, new Set())).rejects.toBeInstanceOf(
      SpotifyRateLimitError,
    );
  });

  it("degrades to an empty map (no throw) when Spotify auth fails — capture proceeds for already-mapped tracks", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(generateAccessToken).mockResolvedValue({
      access_token: null,
      error: new Error("down"),
    } as never);

    const mapped = await mapUnmappedAlbumTracks(ALBUMS, new Set());

    expect(mapped.size).toBe(0);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
