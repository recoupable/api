import { beforeEach, expect, it, vi } from "vitest";
import { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
import { savePackFoundationRecord } from "../savePackFoundationRecord";
import { createPackFoundationPlan } from "../createPackFoundationPlan";
import { foundationFixture } from "./foundationFixture";
vi.mock("@/lib/supabase/release_pack_jobs/runPackCommand", () => ({ runPackCommand: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it("persists a JSON readiness record through the existing context command without replacing audio analysis", async () => {
  const snapshot = foundationFixture();
  vi.mocked(runPackCommand).mockResolvedValue(snapshot);
  const record = {
    plan: createPackFoundationPlan(snapshot, { dependentAssetIds: ["video-0"] }),
    state: "pending" as const,
    files: [],
  };
  await savePackFoundationRecord({ accountId: "owner" }, snapshot.job, record);
  expect(runPackCommand).toHaveBeenLastCalledWith({ accountId: "owner" }, "context", "job", {
    value: { state: "complete", summary: "Retained audio", shared_foundation: record },
  });
});
it("refuses a stale direction/quote before writing", async () => {
  const snapshot = foundationFixture();
  const record = {
    plan: createPackFoundationPlan(snapshot, { dependentAssetIds: [] }),
    state: "pending" as const,
    files: [],
  };
  snapshot.job.brief.creative_direction = "Different";
  vi.mocked(runPackCommand).mockResolvedValue(snapshot);
  await expect(
    savePackFoundationRecord({ accountId: "owner" }, snapshot.job, record),
  ).rejects.toThrow(/changed|brief/);
  expect(runPackCommand).toHaveBeenCalledTimes(1);
});
