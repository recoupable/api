import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTrackHistoricStatsApifyFirst } from "../getTrackHistoricStatsApifyFirst";
import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";
import { deductCredits } from "@/lib/research/deductCredits";

vi.mock("@/lib/supabase/song_measurements/selectSongMeasurements", () => ({
  selectSongMeasurements: vi.fn(),
}));
vi.mock("@/lib/research/deductCredits", () => ({ deductCredits: vi.fn() }));

const ISRC = "USA2P2015959";
const row = (captured_at: string, value: number) =>
  ({
    song: ISRC,
    platform: "spotify",
    metric: "platform_displayed_play_count",
    value,
    captured_at,
    data_source: "apify_spotify_playcount",
  }) as never;

describe("getTrackHistoricStatsApifyFirst", () => {
  beforeEach(() => vi.clearAllMocks());

  it("serves the stored series and deducts credits", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([
      row("2026-06-10T23:10:49Z", 1332534384),
      row("2026-05-10T23:10:49Z", 1300000000),
    ]);

    const result = await getTrackHistoricStatsApifyFirst({
      accountId: "acc_1",
      isrc: ISRC,
      modelId: "GET /api/research/track/historic-stats",
    });

    expect(selectSongMeasurements).toHaveBeenCalledWith({
      song: ISRC,
      platform: "spotify",
      metric: "platform_displayed_play_count",
    });
    expect(deductCredits).toHaveBeenCalledWith("acc_1", "GET /api/research/track/historic-stats");
    const data = (result as { data: { stats: Array<{ data: { history: unknown[] } }> } }).data;
    expect(data.stats[0].data.history).toEqual([
      { date: "2026-05-10", streams_total: 1300000000, data_source: "apify_spotify_playcount" },
      { date: "2026-06-10", streams_total: 1332534384, data_source: "apify_spotify_playcount" },
    ]);
  });

  it("honors the date window on the stored series", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([
      row("2026-06-10T23:10:49Z", 1332534384),
      row("2024-01-01T00:00:00Z", 900000000),
    ]);

    const result = await getTrackHistoricStatsApifyFirst({
      accountId: "acc_1",
      isrc: ISRC,
      startDate: "2026-01-01",
    });

    const data = (result as { data: { stats: Array<{ data: { history: unknown[] } }> } }).data;
    expect(data.stats[0].data.history).toEqual([
      { date: "2026-06-10", streams_total: 1332534384, data_source: "apify_spotify_playcount" },
    ]);
  });

  it("returns 404 without charging when nothing is stored", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([]);

    const result = await getTrackHistoricStatsApifyFirst({ accountId: "acc_1", isrc: ISRC });

    expect(deductCredits).not.toHaveBeenCalled();
    expect(result).toEqual({
      error: "No measurements for this track yet — create a current measurement job to capture it",
      status: 404,
    });
  });
});
