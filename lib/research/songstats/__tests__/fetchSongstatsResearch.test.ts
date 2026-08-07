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

  it("maps public platform metric sources to SongStats stats source IDs", async () => {
    vi.mocked(fetchSongstats).mockResolvedValue({
      status: 200,
      data: { stats: [] },
    });

    await fetchSongstatsResearch("/artist/artist_1/stat/spotify");

    expect(fetchSongstats).toHaveBeenCalledWith("/artists/stats", {
      songstats_artist_id: "artist_1",
      source: "spotify",
    });
  });

  it("maps public audience platforms to SongStats metric source IDs", async () => {
    vi.mocked(fetchSongstats).mockResolvedValue({
      status: 200,
      data: { audience: [] },
    });

    await fetchSongstatsResearch("/artist/artist_1/instagram-audience-stats");

    expect(fetchSongstats).toHaveBeenCalledWith("/artists/audience", {
      songstats_artist_id: "artist_1",
      source: "instagram_followers",
    });
  });

  it("treats artist rank as unsupported for SongStats instead of querying broad stats", async () => {
    const result = await fetchSongstatsResearch("/artist/artist_1/artist-rank");

    expect(result).toEqual({
      status: 501,
      data: { error: "Research data source does not support this endpoint" },
    });
    expect(fetchSongstats).not.toHaveBeenCalled();
  });

  it("maps similar artists to SongStats related artists without forwarding unsupported weights", async () => {
    vi.mocked(fetchSongstats).mockResolvedValue({
      status: 200,
      data: {
        artist_info: {
          related_artists: [
            { songstats_artist_id: "artist_2", name: "Kendrick Lamar" },
            { songstats_artist_id: "artist_3", name: "J. Cole" },
          ],
        },
      },
    });

    const result = await fetchSongstatsResearch(
      "/artist/artist_1/similar-artists/by-configurations",
      {
        audience: "high",
        genre: "medium",
        mood: "low",
        musicality: "medium",
        limit: "1",
      },
    );

    expect(fetchSongstats).toHaveBeenCalledWith("/artists/info", {
      songstats_artist_id: "artist_1",
    });
    expect(result).toEqual({
      status: 200,
      data: [{ id: "artist_2", songstats_artist_id: "artist_2", name: "Kendrick Lamar" }],
    });
  });

  it("maps current artist playlists to top_playlists with scope=current and flattens placements", async () => {
    vi.mocked(fetchSongstats).mockResolvedValue({
      status: 200,
      data: {
        result: "success",
        data: [
          {
            source: "spotify",
            metric: "top_playlists",
            scope: "current",
            top_playlists: [
              { playlist_id: "p1", playlist_name: "Today's Top Hits" },
              { playlist_id: "p2", playlist_name: "RapCaviar" },
            ],
          },
        ],
      },
    });

    const result = await fetchSongstatsResearch("/artist/artist_1/spotify/current/playlists");

    expect(fetchSongstats).toHaveBeenCalledWith("/artists/top_playlists", {
      songstats_artist_id: "artist_1",
      source: "spotify",
      scope: "current",
    });
    expect(result).toEqual({
      status: 200,
      data: [
        { playlist_id: "p1", playlist_name: "Today's Top Hits" },
        { playlist_id: "p2", playlist_name: "RapCaviar" },
      ],
    });
  });

  it("maps current track playlists to tracks/top_playlists and drops legacy filter params", async () => {
    vi.mocked(fetchSongstats).mockResolvedValue({
      status: 200,
      data: {
        result: "success",
        data: [
          {
            source: "spotify",
            top_playlists: [{ playlist_id: "p1", playlist_name: "RapCaviar" }],
          },
        ],
      },
    });

    const result = await fetchSongstatsResearch("/track/track_1/spotify/current/playlists", {
      limit: "5",
      editorial: "true",
      indie: "true",
    });

    expect(fetchSongstats).toHaveBeenCalledWith("/tracks/top_playlists", {
      songstats_track_id: "track_1",
      source: "spotify",
      scope: "current",
      limit: "5",
    });
    expect(result).toEqual({
      status: 200,
      data: [{ playlist_id: "p1", playlist_name: "RapCaviar" }],
    });
  });

  it("maps past track playlists to tracks/top_playlists with scope=total", async () => {
    vi.mocked(fetchSongstats).mockResolvedValue({
      status: 200,
      data: { result: "success", data: [{ source: "deezer", top_playlists: [] }] },
    });

    await fetchSongstatsResearch("/track/track_1/deezer/past/playlists");

    expect(fetchSongstats).toHaveBeenCalledWith("/tracks/top_playlists", {
      songstats_track_id: "track_1",
      source: "deezer",
      scope: "total",
    });
  });

  it("maps past artist playlists to top_playlists with scope=total", async () => {
    vi.mocked(fetchSongstats).mockResolvedValue({
      status: 200,
      data: { result: "success", data: [{ source: "spotify", top_playlists: [] }] },
    });

    await fetchSongstatsResearch("/artist/artist_1/spotify/past/playlists");

    expect(fetchSongstats).toHaveBeenCalledWith("/artists/top_playlists", {
      songstats_artist_id: "artist_1",
      source: "spotify",
      scope: "total",
    });
  });
});
