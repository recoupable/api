import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAlbumMeasurements } from "../getAlbumMeasurements";
import { getAlbumPlaycounts } from "@/lib/research/playcounts/getAlbumPlaycounts";

vi.mock("@/lib/research/playcounts/getAlbumPlaycounts", () => ({ getAlbumPlaycounts: vi.fn() }));

describe("getAlbumMeasurements", () => {
  beforeEach(() => vi.clearAllMocks());

  it("remaps the album playcounts read into the measurements shape", async () => {
    vi.mocked(getAlbumPlaycounts).mockResolvedValue({
      data: {
        status: "success",
        album: { spotify_album_id: "AL1" },
        playcounts: [
          {
            isrc: "I1",
            spotify_track_id: "T1",
            name: "Song",
            platform_displayed_play_count: 500,
            captured_at: "2026-06-12T00:00:00+00:00",
            data_source: "apify_spotify_playcount",
          },
        ],
      },
    });

    const r = await getAlbumMeasurements({ accountId: "acc_1", spotifyAlbumId: "AL1" });

    expect(getAlbumPlaycounts).toHaveBeenCalledWith({ accountId: "acc_1", spotifyAlbumId: "AL1" });
    expect(r).toEqual({
      data: {
        status: "success",
        id: "AL1",
        platform: "spotify",
        metric: "platform_displayed_play_count",
        measurements: [
          {
            isrc: "I1",
            spotify_track_id: "T1",
            name: "Song",
            value: 500,
            captured_at: "2026-06-12T00:00:00+00:00",
            data_source: "apify_spotify_playcount",
          },
        ],
      },
    });
  });

  it("propagates a 404 from the underlying read", async () => {
    vi.mocked(getAlbumPlaycounts).mockResolvedValue({ error: "No snapshot", status: 404 });
    const r = await getAlbumMeasurements({ accountId: "acc_1", spotifyAlbumId: "AL1" });
    expect(r).toEqual({ error: "No snapshot", status: 404 });
  });
});
