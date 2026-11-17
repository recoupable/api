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
    value: {
      state: "complete",
      summary: "Retained audio",
      audio: { storage_key: "owner/release-packs/song.mp3" },
      references: [],
      visual_direction: "Blue paper",
      proposed_start_seconds: 0,
      selected_start_seconds: 0,
      duration_seconds: 120,
      shared_foundation: record,
    },
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
it("can persist a capacity conflict before audio preparation without inventing a completed context", async () => {
  const snapshot = foundationFixture();
  snapshot.job.production_context = null;
  vi.mocked(runPackCommand).mockResolvedValue(snapshot);
  const record = {
    plan: createPackFoundationPlan(snapshot, { dependentAssetIds: ["video-0"] }),
    state: "pending" as const,
    files: [],
    blocked_reason: "reference_limit" as const,
  };
  await savePackFoundationRecord({ accountId: "owner" }, snapshot.job, record);
  expect(runPackCommand).toHaveBeenLastCalledWith({ accountId: "owner" }, "context", "job", {
    value: { shared_foundation: record },
  });
});

it("rejects malformed completed preparation before persisting readiness", async () => {
  const snapshot = foundationFixture();
  snapshot.job.production_context = { state: "complete", summary: "Incomplete" };
  vi.mocked(runPackCommand).mockResolvedValue(snapshot);
  const record = {
    plan: createPackFoundationPlan(snapshot, { dependentAssetIds: [] }),
    state: "pending" as const,
    files: [],
  };
  await expect(
    savePackFoundationRecord({ accountId: "owner" }, snapshot.job, record),
  ).rejects.toThrow();
  expect(runPackCommand).toHaveBeenCalledTimes(1);
});
