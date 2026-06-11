import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTrackHistoricStatsApifyFirst } from "../getTrackHistoricStatsApifyFirst";

import { getResearchTrackHistoricStats } from "@/lib/research/getResearchTrackHistoricStats";
import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";
import { upsertSongstatsBackfillQueue } from "@/lib/supabase/songstats_backfill_queue/upsertSongstatsBackfillQueue";
import { deductCredits } from "@/lib/research/deductCredits";

vi.mock("@/lib/research/getResearchTrackHistoricStats", () => ({
  getResearchTrackHistoricStats: vi.fn(),
}));
vi.mock("@/lib/supabase/song_measurements/selectSongMeasurements", () => ({
  selectSongMeasurements: vi.fn(),
}));
vi.mock("@/lib/supabase/songstats_backfill_queue/upsertSongstatsBackfillQueue", () => ({
  upsertSongstatsBackfillQueue: vi.fn(),
}));
vi.mock("@/lib/research/deductCredits", () => ({ deductCredits: vi.fn() }));

const ISRC = "USA2P2015959";

const apifyRow = {
  song: ISRC,
  platform: "spotify",
  metric: "platform_displayed_play_count",
  value: 1332534384,
  captured_at: "2026-06-10T23:10:49Z",
  data_source: "apify_spotify_playcount",
} as never;

const songstatsRow = {
  ...(apifyRow as object as Record<string, unknown>),
  value: 900000000,
  captured_at: "2024-01-01T00:00:00Z",
  data_source: "songstats",
} as never;

describe("getTrackHistoricStatsApifyFirst", () => {
  beforeEach(() => vi.clearAllMocks());

  it("serves a head track (mixed songstats + apify points) from the store without enqueueing", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([apifyRow, songstatsRow]);

    const result = await getTrackHistoricStatsApifyFirst({
      accountId: "acc_1",
      params: { isrc: ISRC, source: "spotify" },
    });

    expect(getResearchTrackHistoricStats).not.toHaveBeenCalled();
    expect(upsertSongstatsBackfillQueue).not.toHaveBeenCalled();
    expect(deductCredits).toHaveBeenCalledWith("acc_1");
    const data = (result as { data: { stats: Array<{ data: { history: unknown[] } }> } }).data;
    expect(data.stats[0].data.history).toEqual([
      { date: "2024-01-01", streams_total: 900000000, data_source: "songstats" },
      { date: "2026-06-10", streams_total: 1332534384, data_source: "apify_spotify_playcount" },
    ]);
  });

  it("returns snapshot-only points for an unbackfilled track and enqueues it", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([apifyRow]);

    const result = await getTrackHistoricStatsApifyFirst({
      accountId: "acc_1",
      params: { isrc: ISRC, source: "spotify" },
    });

    expect(upsertSongstatsBackfillQueue).toHaveBeenCalledWith({
      song: ISRC,
      rank_score: 1332534384,
    });
    const data = (result as { data: { stats: Array<{ data: { history: unknown[] } }> } }).data;
    expect(data.stats[0].data.history).toHaveLength(1);
  });

  it("merges store spotify with Songstats for remaining sources, labeling per-point provenance", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([apifyRow, songstatsRow]);
    vi.mocked(getResearchTrackHistoricStats).mockResolvedValue({
      data: {
        result: "success",
        stats: [
          { source: "deezer", data: { history: [{ date: "2026-06-01", streams_total: 5 }] } },
        ],
      },
    });

    const result = await getTrackHistoricStatsApifyFirst({
      accountId: "acc_1",
      params: { isrc: ISRC, source: "spotify,deezer" },
    });

    expect(getResearchTrackHistoricStats).toHaveBeenCalledWith({
      accountId: "acc_1",
      params: { isrc: ISRC, source: "deezer" },
    });
    const data = (
      result as {
        data: {
          stats: Array<{ source?: string; data: { history: Array<Record<string, unknown>> } }>;
        };
      }
    ).data;
    expect(data.stats[0].data.history[0].data_source).toBe("songstats");
    expect(data.stats[1].source).toBe("spotify");
  });

  it("does not consult the store for non-spotify sources or non-isrc identifiers", async () => {
    vi.mocked(getResearchTrackHistoricStats).mockResolvedValue({
      data: { result: "success", stats: [] },
    });

    await getTrackHistoricStatsApifyFirst({
      accountId: "acc_1",
      params: { isrc: ISRC, source: "deezer" },
    });
    await getTrackHistoricStatsApifyFirst({
      accountId: "acc_1",
      params: { spotify_track_id: "x", source: "spotify" },
    });

    expect(selectSongMeasurements).not.toHaveBeenCalled();
    expect(getResearchTrackHistoricStats).toHaveBeenCalledTimes(2);
  });

  it("passes through upstream error results untouched", async () => {
    vi.mocked(getResearchTrackHistoricStats).mockResolvedValue({
      error: "Request failed with status 429",
      status: 429,
    });

    const result = await getTrackHistoricStatsApifyFirst({
      accountId: "acc_1",
      params: { isrc: "BADISRC", source: "deezer" },
    });

    expect(result).toEqual({ error: "Request failed with status 429", status: 429 });
  });

  it("honors start_date/end_date on the store-served series", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([apifyRow, songstatsRow]);

    const result = await getTrackHistoricStatsApifyFirst({
      accountId: "acc_1",
      params: { isrc: ISRC, source: "spotify", start_date: "2026-01-01" },
    });

    const data = (result as { data: { stats: Array<{ data: { history: unknown[] } }> } }).data;
    expect(data.stats[0].data.history).toEqual([
      { date: "2026-06-10", streams_total: 1332534384, data_source: "apify_spotify_playcount" },
    ]);
  });
});
