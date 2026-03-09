import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDeletePRState = vi.fn();
vi.mock("../prState", () => ({
  deleteCodingAgentPRState: (...args: unknown[]) => mockDeletePRState(...args),
}));

const mockUpsertAccountSnapshot = vi.fn();
vi.mock("@/lib/supabase/account_snapshots/upsertAccountSnapshot", () => ({
  upsertAccountSnapshot: (...args: unknown[]) => mockUpsertAccountSnapshot(...args),
}));

const { handleMergeSuccess } = await import("../handleMergeSuccess");

beforeEach(() => {
  vi.clearAllMocks();
  mockUpsertAccountSnapshot.mockResolvedValue({ data: {}, error: null });
});

describe("handleMergeSuccess", () => {
  it("deletes PR state and persists snapshot", async () => {
    await handleMergeSuccess({
      status: "pr_created",
      branch: "agent/fix-bug",
      snapshotId: "snap_abc123",
      prs: [{ repo: "recoupable/api", number: 42, url: "url", baseBranch: "test" }],
    });

    expect(mockDeletePRState).toHaveBeenCalledWith("recoupable/api", "agent/fix-bug");
    expect(mockUpsertAccountSnapshot).toHaveBeenCalledWith({
      account_id: "04e3aba9-c130-4fb8-8b92-34e95d43e66b",
      snapshot_id: "snap_abc123",
      expires_at: expect.any(String),
    });
  });

  it("skips snapshot persistence when snapshotId is not in state", async () => {
    await handleMergeSuccess({
      status: "pr_created",
      branch: "agent/fix-bug",
      prs: [{ repo: "recoupable/api", number: 42, url: "url", baseBranch: "test" }],
    });

    expect(mockDeletePRState).toHaveBeenCalledWith("recoupable/api", "agent/fix-bug");
    expect(mockUpsertAccountSnapshot).not.toHaveBeenCalled();
  });

  it("logs error but does not throw when snapshot persistence fails", async () => {
    mockUpsertAccountSnapshot.mockResolvedValue({
      data: null,
      error: { message: "db error", code: "500" },
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await handleMergeSuccess({
      status: "pr_created",
      branch: "agent/fix-bug",
      snapshotId: "snap_abc123",
      prs: [{ repo: "recoupable/api", number: 42, url: "url", baseBranch: "test" }],
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("failed to persist snapshot"),
      expect.anything(),
    );
    consoleSpy.mockRestore();
  });

  it("skips PR state cleanup when branch is missing", async () => {
    await handleMergeSuccess({
      status: "pr_created",
      prs: [{ repo: "recoupable/api", number: 42, url: "url", baseBranch: "test" }],
    });

    expect(mockDeletePRState).not.toHaveBeenCalled();
  });
});
