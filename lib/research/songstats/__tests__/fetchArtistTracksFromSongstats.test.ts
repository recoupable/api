import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchArtistTracksFromSongstats } from "../fetchArtistTracksFromSongstats";
import { fetchSongstats } from "@/lib/songstats/fetchSongstats";

vi.mock("@/lib/songstats/fetchSongstats", () => ({
  fetchSongstats: vi.fn(),
}));

describe("fetchArtistTracksFromSongstats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns top_tracks when SongStats provides them", async () => {
    vi.mocked(fetchSongstats).mockResolvedValueOnce({
      status: 200,
      data: {
        data: [
          {
            source: "spotify",
            top_tracks: [
              { title: "God's Plan", songstats_track_id: "tr_1" },
              { title: "Remix feat. X", songstats_track_id: "tr_2" },
            ],
          },
        ],
      },
    });

    const result = await fetchArtistTracksFromSongstats("artist_1");

    expect(fetchSongstats).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 200,
      data: [{ title: "God's Plan", songstats_track_id: "tr_1", id: "tr_1" }],
    });
  });

  it("falls back to filtered catalog when top_tracks is empty", async () => {
    vi.mocked(fetchSongstats)
      .mockResolvedValueOnce({
        status: 200,
        data: { data: [{ source: "spotify", top_tracks: [] }] },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          catalog: [
            { title: "Take Care", songstats_track_id: "tr_1" },
            { title: "Headlines (Remix)", songstats_track_id: "tr_2" },
          ],
        },
      });

    const result = await fetchArtistTracksFromSongstats("artist_1", { limit: "10" });

    expect(fetchSongstats).toHaveBeenNthCalledWith(1, "/artists/top_tracks", {
      songstats_artist_id: "artist_1",
      source: "spotify",
      metric: "popularity",
      limit: "10",
    });
    expect(fetchSongstats).toHaveBeenNthCalledWith(2, "/artists/catalog", {
      songstats_artist_id: "artist_1",
      is_primary: "true",
      isPrimary: "true",
      limit: "10",
    });
    expect(result).toEqual({
      status: 200,
      data: [{ title: "Take Care", songstats_track_id: "tr_1", id: "tr_1" }],
    });
  });
});
