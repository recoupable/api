import { describe, it, expect } from "vitest";
import { buildSpotifyHistoricStat } from "../buildSpotifyHistoricStat";

const row = (capturedAt: string, value: number, dataSource: string) =>
  ({
    song: "USA2P2015959",
    platform: "spotify",
    metric: "platform_displayed_play_count",
    value,
    captured_at: capturedAt,
    data_source: dataSource,
  }) as never;

describe("buildSpotifyHistoricStat", () => {
  it("maps store rows to an ascending per-date history with per-point provenance", () => {
    const result = buildSpotifyHistoricStat(
      [
        row("2026-06-10T23:10:49Z", 1332534384, "apify_spotify_playcount"),
        row("2026-06-09T07:00:00Z", 1331384578, "apify_spotify_playcount"),
        row("2024-01-01T00:00:00Z", 900000000, "songstats"),
      ],
      {},
    );

    expect(result).toEqual({
      source: "spotify",
      data: {
        history: [
          { date: "2024-01-01", streams_total: 900000000, data_source: "songstats" },
          { date: "2026-06-09", streams_total: 1331384578, data_source: "apify_spotify_playcount" },
          { date: "2026-06-10", streams_total: 1332534384, data_source: "apify_spotify_playcount" },
        ],
      },
    });
  });

  it("dedupes same-date points preferring the apify capture", () => {
    const result = buildSpotifyHistoricStat(
      [
        row("2026-06-10T23:00:00Z", 1332534384, "apify_spotify_playcount"),
        row("2026-06-10T01:00:00Z", 1332000000, "songstats"),
      ],
      {},
    );

    expect(result.data.history).toEqual([
      { date: "2026-06-10", streams_total: 1332534384, data_source: "apify_spotify_playcount" },
    ]);
  });

  it("honors start_date/end_date bounds", () => {
    const result = buildSpotifyHistoricStat(
      [
        row("2026-06-10T23:00:00Z", 3, "apify_spotify_playcount"),
        row("2026-06-09T01:00:00Z", 2, "apify_spotify_playcount"),
        row("2024-01-01T00:00:00Z", 1, "songstats"),
      ],
      { startDate: "2026-06-09", endDate: "2026-06-09" },
    );

    expect(result.data.history).toEqual([
      { date: "2026-06-09", streams_total: 2, data_source: "apify_spotify_playcount" },
    ]);
  });

  it("returns an empty history for no rows", () => {
    expect(buildSpotifyHistoricStat([], {})).toEqual({
      source: "spotify",
      data: { history: [] },
    });
  });
});
