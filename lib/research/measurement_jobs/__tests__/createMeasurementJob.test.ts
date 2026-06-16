import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMeasurementJob } from "../createMeasurementJob";
import { createSnapshot } from "@/lib/research/playcounts/createSnapshot";
import { enqueueHistoricalBackfill } from "../enqueueHistoricalBackfill";

vi.mock("@/lib/research/playcounts/createSnapshot", () => ({ createSnapshot: vi.fn() }));
vi.mock("../enqueueHistoricalBackfill", () => ({ enqueueHistoricalBackfill: vi.fn() }));

const req = (source: "current" | "historical") => ({
  accountId: "acc_1",
  body: { scope: { album_ids: ["AL1"] }, source, platforms: ["spotify"] as ["spotify"] },
});

describe("createMeasurementJob", () => {
  beforeEach(() => vi.clearAllMocks());

  it("historical → delegates to enqueueHistoricalBackfill with the scope", async () => {
    vi.mocked(enqueueHistoricalBackfill).mockResolvedValue({
      data: { status: "success", source: "historical", id: null, enqueued: 5, skipped: 1 },
    });
    const r = await createMeasurementJob(req("historical"));
    expect(enqueueHistoricalBackfill).toHaveBeenCalledWith({ album_ids: ["AL1"] });
    expect(createSnapshot).not.toHaveBeenCalled();
    expect(r).toEqual({
      data: { status: "success", source: "historical", id: null, enqueued: 5, skipped: 1 },
    });
  });

  it("current → reuses the snapshot pipeline and maps snapshot_id to the job id", async () => {
    vi.mocked(createSnapshot).mockResolvedValue({
      data: {
        status: "success",
        snapshot_id: "snap_9",
        state: "queued",
        album_count: 3,
        estimated_cost_usd: 0.009,
      },
    });
    const r = await createMeasurementJob(req("current"));
    expect(createSnapshot).toHaveBeenCalledWith({
      accountId: "acc_1",
      body: { album_ids: ["AL1"], platforms: ["spotify"], schedule: "once" },
    });
    expect(r).toEqual({
      data: {
        status: "success",
        source: "current",
        id: "snap_9",
        state: "queued",
        album_count: 3,
        estimated_cost_usd: 0.009,
      },
    });
  });

  it("current → propagates a snapshot error (e.g. 429 cap)", async () => {
    vi.mocked(createSnapshot).mockResolvedValue({ error: "cap reached", status: 429 });
    const r = await createMeasurementJob(req("current"));
    expect(r).toEqual({ error: "cap reached", status: 429 });
  });
});
