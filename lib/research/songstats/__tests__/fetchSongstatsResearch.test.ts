import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchSongstatsResearch } from "../fetchSongstatsResearch";
import { fetchSongstats } from "@/lib/songstats/fetchSongstats";

vi.mock("@/lib/songstats/fetchSongstats", () => ({
  fetchSongstats: vi.fn(),
}));

describe("fetchSongstatsResearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps artist searches to SongStats artist search and keeps the public results family", async () => {
    vi.mocked(fetchSongstats).mockResolvedValue({
      status: 200,
      data: { results: [{ songstats_artist_id: "artist_1", name: "Drake" }] },
    });

    const result = await fetchSongstatsResearch("/search", {
      q: "Drake",
      type: "artists",
      limit: "1",
      beta: "true",
    });

    expect(fetchSongstats).toHaveBeenCalledWith("/artists/search", {
      q: "Drake",
      limit: "1",
    });
    expect(result).toEqual({
      status: 200,
      data: { artists: [{ id: "artist_1", songstats_artist_id: "artist_1", name: "Drake" }] },
    });
  });

  it("maps track detail requests to SongStats track info", async () => {
    vi.mocked(fetchSongstats).mockResolvedValue({
      status: 200,
      data: { songstats_track_id: "track_1", title: "Hotline Bling" },
    });

    const result = await fetchSongstatsResearch("/track/track_1");

    expect(fetchSongstats).toHaveBeenCalledWith("/tracks/info", {
      songstats_track_id: "track_1",
    });
    expect(result).toEqual({
      status: 200,
      data: { id: "track_1", songstats_track_id: "track_1", title: "Hotline Bling" },
    });
  });

  it("maps Spotify artist lookup to SongStats artist info and exposes a provider-neutral id", async () => {
    vi.mocked(fetchSongstats).mockResolvedValue({
      status: 200,
      data: { songstats_artist_id: "artist_1", spotify_artist_id: "spotify_1" },
    });

    const result = await fetchSongstatsResearch("/artist/spotify/spotify_1/get-ids");

    expect(fetchSongstats).toHaveBeenCalledWith("/artists/info", {
      spotify_artist_id: "spotify_1",
    });
    expect(result).toEqual({
      status: 200,
      data: {
        id: "artist_1",
        songstats_artist_id: "artist_1",
        spotify_artist_id: "spotify_1",
      },
    });
  });

  it("returns an explicit unsupported result for Chartmetric-only paths", async () => {
    const result = await fetchSongstatsResearch("/curator/spotify/2");

    expect(result).toEqual({
      status: 501,
      data: { error: "Research data source does not support this endpoint" },
    });
    expect(fetchSongstats).not.toHaveBeenCalled();
  });
});
