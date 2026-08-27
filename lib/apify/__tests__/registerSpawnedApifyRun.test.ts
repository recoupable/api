import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerSpawnedApifyRun } from "../registerSpawnedApifyRun";
import { selectApifyScraperRun } from "@/lib/supabase/apify_scraper_runs/selectApifyScraperRun";
import { upsertApifyScraperRuns } from "@/lib/supabase/apify_scraper_runs/upsertApifyScraperRuns";

vi.mock("@/lib/supabase/apify_scraper_runs/selectApifyScraperRun", () => ({
  selectApifyScraperRun: vi.fn(),
}));
vi.mock("@/lib/supabase/apify_scraper_runs/upsertApifyScraperRuns", () => ({
  upsertApifyScraperRuns: vi.fn(async () => ({ data: null, error: null })),
}));

beforeEach(() => vi.clearAllMocks());

describe("registerSpawnedApifyRun", () => {
  it("inherits account_id and social_id from the registered parent run", async () => {
    vi.mocked(selectApifyScraperRun).mockResolvedValue([
      { run_id: "run-parent", account_id: "acc-1", social_id: "soc-1" },
    ] as never);

    await registerSpawnedApifyRun({
      runId: "run-child",
      parentRunId: "run-parent",
      origin: "fan",
      platform: "instagram",
    });

    expect(selectApifyScraperRun).toHaveBeenCalledWith({ runId: "run-parent" });
    expect(upsertApifyScraperRuns).toHaveBeenCalledWith([
      {
        run_id: "run-child",
        parent_run_id: "run-parent",
        origin: "fan",
        platform: "instagram",
        account_id: "acc-1",
        social_id: "soc-1",
      },
    ]);
  });

  it("registers with a null account when the parent is unknown (chain rooted before lineage shipped)", async () => {
    vi.mocked(selectApifyScraperRun).mockResolvedValue([]);
    await registerSpawnedApifyRun({
      runId: "run-child",
      parentRunId: "run-legacy",
      origin: "artist",
      platform: "instagram",
    });
    expect(upsertApifyScraperRuns).toHaveBeenCalledWith([
      expect.objectContaining({
        run_id: "run-child",
        parent_run_id: "run-legacy",
        account_id: null,
        social_id: null,
      }),
    ]);
  });

  it("never throws — bookkeeping must not fail the webhook", async () => {
    vi.mocked(selectApifyScraperRun).mockRejectedValue(new Error("db down"));
    await expect(
      registerSpawnedApifyRun({
        runId: "x",
        parentRunId: "y",
        origin: "fan",
        platform: "instagram",
      }),
    ).resolves.toBeUndefined();
  });
});
