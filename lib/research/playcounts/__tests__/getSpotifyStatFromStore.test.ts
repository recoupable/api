import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSpotifyStatFromStore } from "../getSpotifyStatFromStore";

import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";
import { upsertSongMeasurements } from "@/lib/supabase/song_measurements/upsertSongMeasurements";
import { selectSongIdentifiers } from "@/lib/supabase/song_identifiers/selectSongIdentifiers";
import { fetchSpotifyAlbumPlayCounts } from "@/lib/apify/spotify/fetchSpotifyAlbumPlayCounts";

vi.mock("@/lib/supabase/song_measurements/selectSongMeasurements", () => ({
  selectSongMeasurements: vi.fn(),
}));
vi.mock("@/lib/supabase/song_measurements/upsertSongMeasurements", () => ({
  upsertSongMeasurements: vi.fn(),
}));
vi.mock("@/lib/supabase/song_identifiers/selectSongIdentifiers", () => ({
  selectSongIdentifiers: vi.fn(),
}));
vi.mock("@/lib/apify/spotify/fetchSpotifyAlbumPlayCounts", () => ({
  fetchSpotifyAlbumPlayCounts: vi.fn(),
}));

const ISRC = "USUYG1069896";
const NOW = new Date("2026-06-10T12:00:00Z");

const freshRow = {
  song: ISRC,
  platform: "spotify",
  metric: "platform_displayed_play_count",
  value: 1331384578,
  captured_at: "2026-06-10T06:00:00Z", // 6h old
  data_source: "apify_spotify_playcount",
};

const staleRow = { ...freshRow, value: 1331000000, captured_at: "2026-05-01T00:00:00Z" };

describe("getSpotifyStatFromStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it("serves a fresh measurement from the store without calling the actor", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([freshRow] as never);

    const result = await getSpotifyStatFromStore(ISRC);

    expect(result).toEqual({
      source: "spotify",
      data: { streams_total: 1331384578 },
      data_source: "apify_spotify_playcount",
      captured_at: "2026-06-10T06:00:00Z",
    });
    expect(fetchSpotifyAlbumPlayCounts).not.toHaveBeenCalled();
  });

  it("refreshes a stale measurement via the actor, writing all mapped sibling tracks", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([staleRow] as never);
    vi.mocked(selectSongIdentifiers).mockImplementation(async ({ identifierType }) =>
      identifierType === "album_id"
        ? [{ song: ISRC, platform: "spotify", identifier_type: "album_id", value: "album_1" }]
        : [
            { song: ISRC, platform: "spotify", identifier_type: "track_id", value: "track_self" },
            {
              song: "USUYG1069897",
              platform: "spotify",
              identifier_type: "track_id",
              value: "track_sib",
            },
          ],
    );
    vi.mocked(fetchSpotifyAlbumPlayCounts).mockResolvedValue({
      runId: "run_9",
      albums: [
        {
          name: "K.I.D.S. (Deluxe)",
          tracks: [
            { id: "track_self", name: "The Spins", streamCount: 1331384578 },
            { id: "track_sib", name: "Nikes on My Feet", streamCount: 322000000 },
            { id: "track_unmapped", name: "Outro", streamCount: 1000 },
          ],
        },
      ],
    });
    vi.mocked(upsertSongMeasurements).mockResolvedValue([] as never);

    const result = await getSpotifyStatFromStore(ISRC);

    expect(fetchSpotifyAlbumPlayCounts).toHaveBeenCalledWith(["album_1"]);
    expect(upsertSongMeasurements).toHaveBeenCalledWith([
      expect.objectContaining({
        song: ISRC,
        platform: "spotify",
        metric: "platform_displayed_play_count",
        value: 1331384578,
        data_source: "apify_spotify_playcount",
        raw_ref: "run_9",
        captured_at: NOW.toISOString(),
      }),
      expect.objectContaining({ song: "USUYG1069897", value: 322000000 }),
    ]);
    expect(result).toEqual({
      source: "spotify",
      data: { streams_total: 1331384578 },
      data_source: "apify_spotify_playcount",
      captured_at: NOW.toISOString(),
    });
  });

  it("returns null when the song has no spotify album mapping (fallback signal)", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([]);
    vi.mocked(selectSongIdentifiers).mockResolvedValue([]);

    const result = await getSpotifyStatFromStore(ISRC);

    expect(result).toBeNull();
    expect(fetchSpotifyAlbumPlayCounts).not.toHaveBeenCalled();
  });

  it("returns the stale measurement when the actor fails (degrade, not error)", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([staleRow] as never);
    vi.mocked(selectSongIdentifiers).mockResolvedValue([
      { song: ISRC, platform: "spotify", identifier_type: "album_id", value: "album_1" },
    ]);
    vi.mocked(fetchSpotifyAlbumPlayCounts).mockRejectedValue(new Error("actor down"));

    const result = await getSpotifyStatFromStore(ISRC);

    expect(result).toEqual({
      source: "spotify",
      data: { streams_total: 1331000000 },
      data_source: "apify_spotify_playcount",
      captured_at: "2026-05-01T00:00:00Z",
    });
  });

  it("returns null when there is no measurement and the actor fails (full fallback)", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([]);
    vi.mocked(selectSongIdentifiers).mockResolvedValue([
      { song: ISRC, platform: "spotify", identifier_type: "album_id", value: "album_1" },
    ]);
    vi.mocked(fetchSpotifyAlbumPlayCounts).mockRejectedValue(new Error("actor down"));

    const result = await getSpotifyStatFromStore(ISRC);

    expect(result).toBeNull();
  });
});
