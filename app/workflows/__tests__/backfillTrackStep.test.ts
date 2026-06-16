import { describe, it, expect, vi, beforeEach } from "vitest";
import { backfillTrackStep } from "../backfillTrackStep";

import { fetchSongstats } from "@/lib/songstats/fetchSongstats";
import { upsertSongMeasurements } from "@/lib/supabase/song_measurements/upsertSongMeasurements";
import { insertSongstatsQuotaLedger } from "@/lib/supabase/songstats_quota_ledger/insertSongstatsQuotaLedger";
import { updateSongstatsBackfillQueue } from "@/lib/supabase/songstats_backfill_queue/updateSongstatsBackfillQueue";

vi.mock("@/lib/songstats/fetchSongstats", () => ({ fetchSongstats: vi.fn() }));
vi.mock("@/lib/supabase/song_measurements/upsertSongMeasurements", () => ({
  upsertSongMeasurements: vi.fn(),
}));
vi.mock("@/lib/supabase/songstats_quota_ledger/insertSongstatsQuotaLedger", () => ({
  insertSongstatsQuotaLedger: vi.fn(),
}));
vi.mock("@/lib/supabase/songstats_backfill_queue/updateSongstatsBackfillQueue", () => ({
  updateSongstatsBackfillQueue: vi.fn(),
}));

const ROW = { id: "q1", song: "USA2P2015959" } as never;

describe("backfillTrackStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(upsertSongMeasurements).mockResolvedValue([] as never);
  });

  it("writes the historic series as songstats measurements, records spend, marks done", async () => {
    vi.mocked(fetchSongstats).mockResolvedValue({
      status: 200,
      data: {
        stats: [
          {
            source: "spotify",
            data: {
              history: [
                { date: "2025-01-01", streams_total: 1008736324 },
                { date: "2026-01-01", streams_total: 1330251464 },
              ],
            },
          },
        ],
      },
    });

    const result = await backfillTrackStep(ROW);

    expect(fetchSongstats).toHaveBeenCalledWith("tracks/historic_stats", {
      isrc: "USA2P2015959",
      source: "spotify",
    });
    expect(upsertSongMeasurements).toHaveBeenCalledWith([
      {
        song: "USA2P2015959",
        platform: "spotify",
        metric: "platform_displayed_play_count",
        value: 1008736324,
        captured_at: "2025-01-01T00:00:00.000Z",
        data_source: "songstats",
        raw_ref: "songstats-backfill",
      },
      {
        song: "USA2P2015959",
        platform: "spotify",
        metric: "platform_displayed_play_count",
        value: 1330251464,
        captured_at: "2026-01-01T00:00:00.000Z",
        data_source: "songstats",
        raw_ref: "songstats-backfill",
      },
    ]);
    expect(insertSongstatsQuotaLedger).toHaveBeenCalledWith({
      hits: 1,
      purpose: "backfill USA2P2015959",
    });
    expect(updateSongstatsBackfillQueue).toHaveBeenCalledWith("q1", { status: "done" });
    expect(result).toEqual({ ok: true, hitsSpent: 1 });
  });

  it("marks a transient upstream error (429) as failed (reclaimable) and records the spend", async () => {
    vi.mocked(fetchSongstats).mockResolvedValue({ status: 429, data: {} });

    const result = await backfillTrackStep(ROW);

    // transient -> 'failed' so the daily reclaim sweep returns it to 'pending'
    expect(updateSongstatsBackfillQueue).toHaveBeenCalledWith("q1", { status: "failed" });
    expect(insertSongstatsQuotaLedger).toHaveBeenCalledWith({
      hits: 1,
      purpose: "backfill USA2P2015959 (failed 429)",
    });
    expect(upsertSongMeasurements).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, hitsSpent: 1 });
  });

  it("marks a transient 5xx as failed (reclaimable)", async () => {
    vi.mocked(fetchSongstats).mockResolvedValue({ status: 504, data: {} });

    const result = await backfillTrackStep(ROW);

    expect(updateSongstatsBackfillQueue).toHaveBeenCalledWith("q1", { status: "failed" });
    expect(result).toEqual({ ok: false, hitsSpent: 1 });
  });

  it("marks a definitive 404 (no history exists) as done so it is never retried", async () => {
    vi.mocked(fetchSongstats).mockResolvedValue({ status: 404, data: {} });

    const result = await backfillTrackStep(ROW);

    // terminal no-data -> 'done', not 'failed' — the reclaim sweep must not resurrect it
    expect(updateSongstatsBackfillQueue).toHaveBeenCalledWith("q1", { status: "done" });
    expect(insertSongstatsQuotaLedger).toHaveBeenCalledWith({
      hits: 1,
      purpose: "backfill USA2P2015959 (no data 404)",
    });
    expect(upsertSongMeasurements).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, hitsSpent: 1 });
  });
});
