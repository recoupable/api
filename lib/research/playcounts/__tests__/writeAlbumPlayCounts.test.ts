import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeAlbumPlayCounts } from "../writeAlbumPlayCounts";

import { selectSongIdentifiers } from "@/lib/supabase/song_identifiers/selectSongIdentifiers";
import { upsertSongMeasurements } from "@/lib/supabase/song_measurements/upsertSongMeasurements";
import { mapUnmappedAlbumTracks } from "../mapUnmappedAlbumTracks";
import { upsertSongIdentifiers } from "@/lib/supabase/song_identifiers/upsertSongIdentifiers";

vi.mock("@/lib/supabase/song_identifiers/selectSongIdentifiers", () => ({
  selectSongIdentifiers: vi.fn(),
}));
vi.mock("@/lib/supabase/song_measurements/upsertSongMeasurements", () => ({
  upsertSongMeasurements: vi.fn(),
}));
vi.mock("../mapUnmappedAlbumTracks", () => ({ mapUnmappedAlbumTracks: vi.fn() }));
vi.mock("@/lib/supabase/song_identifiers/upsertSongIdentifiers", () => ({
  upsertSongIdentifiers: vi.fn(),
}));

const ALBUMS = [
  {
    id: "album_1",
    name: "K.I.D.S. (Deluxe)",
    tracks: [
      { id: "t1", name: "The Spins", streamCount: 100 },
      { id: "t_unmapped", name: "Outro", streamCount: 5 },
    ],
  },
];

describe("writeAlbumPlayCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T12:00:00Z"));
    vi.mocked(upsertSongMeasurements).mockResolvedValue([] as never);
    vi.mocked(mapUnmappedAlbumTracks).mockResolvedValue(new Map());
  });

  it("self-maps unmapped tracks and writes their measurements too (chat#1794)", async () => {
    vi.mocked(selectSongIdentifiers).mockResolvedValue([
      { song: "ISRC1", platform: "spotify", identifier_type: "track_id", value: "t1" },
    ]);
    vi.mocked(mapUnmappedAlbumTracks).mockResolvedValue(new Map([["t_unmapped", "ISRC_NEW"]]));

    const written = await writeAlbumPlayCounts(ALBUMS, "run_3", {});

    expect(mapUnmappedAlbumTracks).toHaveBeenCalledWith(ALBUMS, new Set(["t1"]));
    const rows = vi.mocked(upsertSongMeasurements).mock.calls[0][0];
    expect(rows.map((r: { song: string }) => r.song).sort()).toEqual(["ISRC1", "ISRC_NEW"]);
    expect(written).toBe(2);
  });

  it("writes one measurement per mapped track with run + snapshot lineage", async () => {
    vi.mocked(selectSongIdentifiers).mockResolvedValue([
      { song: "ISRC1", platform: "spotify", identifier_type: "track_id", value: "t1" },
    ]);

    const written = await writeAlbumPlayCounts(ALBUMS, "run_1", { snapshotId: "snap_1" });

    expect(upsertSongMeasurements).toHaveBeenCalledWith([
      {
        song: "ISRC1",
        platform: "spotify",
        metric: "platform_displayed_play_count",
        value: 100,
        captured_at: "2026-06-11T12:00:00.000Z",
        data_source: "apify_spotify_playcount",
        raw_ref: "run_1",
        snapshot: "snap_1",
      },
    ]);
    expect(written).toBe(1);
  });

  it("upserts album_id mappings for every captured track (heals pre-mapped tracks, chat#1794)", async () => {
    vi.mocked(selectSongIdentifiers).mockResolvedValue([
      { song: "ISRC1", platform: "spotify", identifier_type: "track_id", value: "t1" },
    ]);

    await writeAlbumPlayCounts(ALBUMS, "run_4", {});

    expect(upsertSongIdentifiers).toHaveBeenCalledWith([
      { song: "ISRC1", platform: "spotify", identifier_type: "album_id", value: "album_1" },
    ]);
  });

  it("omits snapshot lineage when not given", async () => {
    vi.mocked(selectSongIdentifiers).mockResolvedValue([
      { song: "ISRC1", platform: "spotify", identifier_type: "track_id", value: "t1" },
    ]);

    await writeAlbumPlayCounts(ALBUMS, "run_2", {});

    const rows = vi.mocked(upsertSongMeasurements).mock.calls[0][0];
    expect(rows[0]).not.toHaveProperty("snapshot");
  });
});
