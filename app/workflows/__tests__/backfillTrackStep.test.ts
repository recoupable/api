import { describe, it, expect, vi, beforeEach } from "vitest";
import { backfillTrackStep } from "../backfillTrackStep";

import { fetchSongstatsWithBackoff } from "@/lib/songstats/fetchSongstatsWithBackoff";
import { upsertSongMeasurements } from "@/lib/supabase/song_measurements/upsertSongMeasurements";
import { insertSongstatsQuotaLedger } from "@/lib/supabase/songstats_quota_ledger/insertSongstatsQuotaLedger";
import { updateSongstatsBackfillQueue } from "@/lib/supabase/songstats_backfill_queue/updateSongstatsBackfillQueue";

vi.mock("@/lib/songstats/fetchSongstatsWithBackoff", () => ({
  fetchSongstatsWithBackoff: vi.fn(),
}));
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
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(upsertSongMeasurements).mockResolvedValue([] as never);
  });

  it("writes the historic series, records the spend, marks done on 200", async () => {
    vi.mocked(fetchSongstatsWithBackoff).mockResolvedValue({
      status: 200,
      attempts: 1,
      retriesExhausted: false,
      data: {
        stats: [
          {
            source: "spotify",
            data: { history: [{ date: "2025-01-01", streams_total: 1008736324 }] },
          },
        ],
      },
    });

    const result = await backfillTrackStep(ROW);

    expect(fetchSongstatsWithBackoff).toHaveBeenCalledWith("tracks/historic_stats", {
      isrc: "USA2P2015959",
      source: "spotify",
    });
    expect(upsertSongMeasurements).toHaveBeenCalled();
    expect(insertSongstatsQuotaLedger).toHaveBeenCalledWith({
      hits: 1,
      purpose: "backfill USA2P2015959",
    });
    expect(updateSongstatsBackfillQueue).toHaveBeenCalledWith("q1", { status: "done" });
    expect(result).toEqual({ ok: true, hitsSpent: 1 });
  });

  it("DEFERS (pending, no quota hit, signals stop) when backoff is exhausted on 429", async () => {
    vi.mocked(fetchSongstatsWithBackoff).mockResolvedValue({
      status: 429,
      attempts: 6,
      retriesExhausted: true,
      data: {},
    });

    const result = await backfillTrackStep(ROW);

    // left pending for the next drain; NO ledger hit (Songstats consumed nothing)
    expect(updateSongstatsBackfillQueue).toHaveBeenCalledWith("q1", { status: "pending" });
    expect(insertSongstatsQuotaLedger).not.toHaveBeenCalled();
    expect(upsertSongMeasurements).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, hitsSpent: 0, deferred: true });
  });

  it("marks a definitive 404 (no history) as done and records the spend", async () => {
    vi.mocked(fetchSongstatsWithBackoff).mockResolvedValue({
      status: 404,
      attempts: 1,
      retriesExhausted: false,
      data: {},
    });

    const result = await backfillTrackStep(ROW);

    expect(updateSongstatsBackfillQueue).toHaveBeenCalledWith("q1", { status: "done" });
    expect(insertSongstatsQuotaLedger).toHaveBeenCalledWith({
      hits: 1,
      purpose: "backfill USA2P2015959 (no data 404)",
    });
    expect(result).toEqual({ ok: false, hitsSpent: 1 });
  });

  it("marks a permanent 4xx (403) as done (terminal) and records the spend", async () => {
    vi.mocked(fetchSongstatsWithBackoff).mockResolvedValue({
      status: 403,
      attempts: 1,
      retriesExhausted: false,
      data: {},
    });

    const result = await backfillTrackStep(ROW);

    expect(updateSongstatsBackfillQueue).toHaveBeenCalledWith("q1", { status: "done" });
    expect(insertSongstatsQuotaLedger).toHaveBeenCalledWith({
      hits: 1,
      purpose: "backfill USA2P2015959 (terminal 403)",
    });
    expect(result).toEqual({ ok: false, hitsSpent: 1 });
  });
});
