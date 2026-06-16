import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMeasurementJob } from "../getMeasurementJob";
import { selectPlaycountSnapshots } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots";

vi.mock("@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots", () => ({
  selectPlaycountSnapshots: vi.fn(),
}));

describe("getMeasurementJob", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the job status for a known id", async () => {
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([
      { id: "snap_9", state: "running", album_count: 3, estimated_cost_usd: 0.009 },
    ] as never);

    const r = await getMeasurementJob({ id: "snap_9" });

    expect(selectPlaycountSnapshots).toHaveBeenCalledWith({ id: "snap_9" });
    expect(r).toEqual({
      data: {
        status: "success",
        id: "snap_9",
        source: "current",
        state: "running",
        album_count: 3,
        estimated_cost_usd: 0.009,
      },
    });
  });

  it("404s for an unknown id", async () => {
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([] as never);
    const r = await getMeasurementJob({ id: "nope" });
    expect(r).toEqual({ error: "Unknown measurement-job id", status: 404 });
  });
});
