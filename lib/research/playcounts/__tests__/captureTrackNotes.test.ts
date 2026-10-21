import { beforeEach, describe, expect, it, vi } from "vitest";
import { mapUnmappedAlbumTracks } from "../mapUnmappedAlbumTracks";
import { generateTrackNotes } from "@/lib/songs/generateTrackNotes";
import { getArtistsWithGenres } from "@/lib/songs/getArtistsWithGenres";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getTracks from "@/lib/spotify/getTracks";
import { upsertSongs } from "@/lib/supabase/songs/upsertSongs";
import { upsertSongIdentifiers } from "@/lib/supabase/song_identifiers/upsertSongIdentifiers";
import { linkSongsToArtists } from "@/lib/songs/linkSongsToArtists";
import type { SpotifyTrack } from "@/types/spotify.types";

vi.mock("@/lib/spotify/generateAccessToken", () => ({ default: vi.fn() }));
vi.mock("@/lib/spotify/getTracks", () => ({ default: vi.fn() }));
vi.mock("@/lib/supabase/songs/upsertSongs", () => ({ upsertSongs: vi.fn() }));
vi.mock("@/lib/supabase/song_identifiers/upsertSongIdentifiers", () => ({
  upsertSongIdentifiers: vi.fn(),
}));
vi.mock("@/lib/songs/linkSongsToArtists", () => ({ linkSongsToArtists: vi.fn() }));
vi.mock("@/lib/songs/getArtistsWithGenres", () => ({ getArtistsWithGenres: vi.fn() }));

const artist = {
  external_urls: { spotify: "https://open.spotify.com/artist/creator" },
  href: "",
  id: "creator",
  name: "Creator",
  type: "artist",
  uri: "",
};
const track: SpotifyTrack = {
  album: {
    album_type: "album",
    total_tracks: 1,
    available_markets: [],
    external_urls: { spotify: "" },
    href: "",
    id: "album",
    images: [],
    name: "Album",
    release_date: "2026-10-01",
    release_date_precision: "day",
    type: "album",
    uri: "",
    artists: [artist],
  },
  artists: [artist],
  available_markets: [],
  disc_number: 1,
  duration_ms: 185000,
  explicit: false,
  external_ids: { isrc: "USABC2600001" },
  external_urls: { spotify: "" },
  href: "",
  id: "track",
  is_playable: true,
  name: "Song",
  popularity: 42,
  track_number: 1,
  type: "track",
  uri: "",
  is_local: false,
};
const albums = [
  { id: "album", name: "Album", tracks: [{ id: "track", name: "Song", streamCount: 1 }] },
];
const expected =
  "Song by Creator - a musical track from Album. The track was released on 2026-10-01, has a popularity score of 42/100 and a duration of 3:05. It has an explicit flag of false.";
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(generateAccessToken).mockResolvedValue({ access_token: "fixture-token" } as never);
  vi.mocked(getTracks).mockResolvedValue({ tracks: [track], error: null });
  vi.mocked(upsertSongs).mockResolvedValue([]);
});
describe("capture track notes", () => {
  it("persists nonempty notes using fetched metadata without genre enrichment reads", async () => {
    const mappings = await mapUnmappedAlbumTracks(albums, new Set());
    expect(upsertSongs).toHaveBeenCalledWith([
      { isrc: track.external_ids.isrc, name: "Song", album: "Album", notes: expected },
    ]);
    expect(linkSongsToArtists).toHaveBeenCalledWith([
      expect.objectContaining({
        notes: expected,
        spotifyArtists: [{ id: "creator", name: "Creator" }],
      }),
    ]);
    expect([...mappings]).toEqual([["track", track.external_ids.isrc]]);
    expect(generateAccessToken).toHaveBeenCalledOnce();
    expect(getTracks).toHaveBeenCalledOnce();
    expect(getArtistsWithGenres).not.toHaveBeenCalled();
  });
  it("retains both reissue identifiers but upserts one song and its final metadata", async () => {
    const deluxe = { ...track, id: "deluxe", album: { ...track.album, name: "Deluxe" } };
    vi.mocked(getTracks).mockResolvedValue({ tracks: [track, deluxe], error: null });
    const items = [
      ...albums,
      {
        id: "deluxe-album",
        name: "Deluxe",
        tracks: [{ id: "deluxe", name: "Song", streamCount: 2 }],
      },
    ];
    const mappings = await mapUnmappedAlbumTracks(items, new Set());
    expect(upsertSongs).toHaveBeenCalledWith([
      expect.objectContaining({
        album: "Deluxe",
        notes: expected.replace("from Album.", "from Deluxe."),
      }),
    ]);
    expect(upsertSongIdentifiers).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ identifier_type: "track_id", value: "track" }),
        expect.objectContaining({ identifier_type: "track_id", value: "deluxe" }),
      ]),
    );
    expect(mappings.size).toBe(2);
    expect(getArtistsWithGenres).not.toHaveBeenCalled();
  });
  it("does no enrichment or writes for already mapped tracks", async () => {
    expect((await mapUnmappedAlbumTracks(albums, new Set(["track"]))).size).toBe(0);
    expect(generateAccessToken).not.toHaveBeenCalled();
    expect(getArtistsWithGenres).not.toHaveBeenCalled();
    expect(upsertSongs).not.toHaveBeenCalled();
  });
  it("does not invent notes for a missing title", async () => {
    vi.mocked(getTracks).mockResolvedValue({ tracks: [{ ...track, name: "" }], error: null });
    await mapUnmappedAlbumTracks(albums, new Set());
    expect(upsertSongs).toHaveBeenCalledWith([expect.objectContaining({ notes: null })]);
  });
});
describe("existing manual note enrichment", () => {
  it("keeps the same text format and genre lookup for manual import", async () => {
    vi.mocked(getArtistsWithGenres).mockResolvedValue("Creator (artist genres: pop)");
    expect(await generateTrackNotes(track)).toBe(
      expected.replace("by Creator", "by Creator (artist genres: pop)"),
    );
    expect(getArtistsWithGenres).toHaveBeenCalledWith(track);
  });
  it("keeps its existing fallback when genre enrichment fails", async () => {
    vi.mocked(getArtistsWithGenres).mockRejectedValue(new Error("fixture failure"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await generateTrackNotes(track)).toBe("Song by Creator - a musical track from Album.");
    error.mockRestore();
  });
});
