import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAlbumPlaycounts } from "../getAlbumPlaycounts";

import { selectSongIdentifiers } from "@/lib/supabase/song_identifiers/selectSongIdentifiers";
import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";
import { selectSongs } from "@/lib/supabase/songs/selectSongs";
import { deductCredits } from "@/lib/research/deductCredits";

vi.mock("@/lib/supabase/song_identifiers/selectSongIdentifiers", () => ({
  selectSongIdentifiers: vi.fn(),
}));
vi.mock("@/lib/supabase/song_measurements/selectSongMeasurements", () => ({
  selectSongMeasurements: vi.fn(),
}));
vi.mock("@/lib/supabase/songs/selectSongs", () => ({ selectSongs: vi.fn() }));
vi.mock("@/lib/research/deductCredits", () => ({ deductCredits: vi.fn() }));

const ALBUM = "70Zkfb99ladZ3q0JVg97co";

describe("getAlbumPlaycounts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns latest playcounts for every mapped track on the album", async () => {
    vi.mocked(selectSongIdentifiers).mockImplementation(async ({ identifierType }) =>
      identifierType === "album_id"
        ? [
            { song: "ISRC_A", platform: "spotify", identifier_type: "album_id", value: ALBUM },
            { song: "ISRC_B", platform: "spotify", identifier_type: "album_id", value: ALBUM },
          ]
        : [
            { song: "ISRC_A", platform: "spotify", identifier_type: "track_id", value: "t_a" },
            { song: "ISRC_B", platform: "spotify", identifier_type: "track_id", value: "t_b" },
          ],
    );
    vi.mocked(selectSongMeasurements).mockResolvedValue([
      // newest-first; ISRC_A has two captures — latest must win
      {
        song: "ISRC_A",
        value: 200,
        captured_at: "2026-06-10T23:00:00Z",
        data_source: "apify_spotify_playcount",
      },
      {
        song: "ISRC_B",
        value: 50,
        captured_at: "2026-06-10T23:00:00Z",
        data_source: "apify_spotify_playcount",
      },
      {
        song: "ISRC_A",
        value: 100,
        captured_at: "2026-06-09T07:00:00Z",
        data_source: "apify_spotify_playcount",
      },
    ] as never);
    vi.mocked(selectSongs).mockResolvedValue([
      { isrc: "ISRC_A", name: "The Spins", album: "K.I.D.S. (Deluxe)" },
      { isrc: "ISRC_B", name: "Nikes on My Feet", album: "K.I.D.S. (Deluxe)" },
    ] as never);

    const result = await getAlbumPlaycounts({ accountId: "acc_1", spotifyAlbumId: ALBUM });

    expect(selectSongMeasurements).toHaveBeenCalledWith({
      songs: ["ISRC_A", "ISRC_B"],
      platform: "spotify",
      metric: "platform_displayed_play_count",
    });
    expect(deductCredits).toHaveBeenCalledWith("acc_1");
    expect(result).toEqual({
      data: {
        status: "success",
        album: {
          spotify_album_id: ALBUM,
          name: "K.I.D.S. (Deluxe)",
          label: null,
          copyright: null,
        },
        playcounts: [
          {
            isrc: "ISRC_A",
            spotify_track_id: "t_a",
            name: "The Spins",
            platform_displayed_play_count: 200,
            captured_at: "2026-06-10T23:00:00Z",
            data_source: "apify_spotify_playcount",
          },
          {
            isrc: "ISRC_B",
            spotify_track_id: "t_b",
            name: "Nikes on My Feet",
            platform_displayed_play_count: 50,
            captured_at: "2026-06-10T23:00:00Z",
            data_source: "apify_spotify_playcount",
          },
        ],
      },
    });
  });

  it("returns 404 when the album has no mapped tracks", async () => {
    vi.mocked(selectSongIdentifiers).mockResolvedValue([]);

    const result = await getAlbumPlaycounts({ accountId: "acc_1", spotifyAlbumId: "unknown" });

    expect(result).toEqual({
      error: "No snapshot exists for this album yet — create one with POST /api/research/snapshots",
      status: 404,
    });
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it("returns 404 when mapped tracks have no measurements yet", async () => {
    vi.mocked(selectSongIdentifiers).mockResolvedValue([
      { song: "ISRC_A", platform: "spotify", identifier_type: "album_id", value: ALBUM },
    ]);
    vi.mocked(selectSongMeasurements).mockResolvedValue([]);

    const result = await getAlbumPlaycounts({ accountId: "acc_1", spotifyAlbumId: ALBUM });

    expect(result).toEqual({
      error: "No snapshot exists for this album yet — create one with POST /api/research/snapshots",
      status: 404,
    });
  });
});
