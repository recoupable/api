import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDeletePRState = vi.fn();
vi.mock("../prState", () => ({
  deleteCodingAgentPRState: (...args: unknown[]) => mockDeletePRState(...args),
}));

const { handleMergeSuccess } = await import("../handleMergeSuccess");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleMergeSuccess", () => {
  it("deletes PR state", async () => {
    await handleMergeSuccess({
      status: "pr_created",
      branch: "agent/fix-bug",
      prs: [{ repo: "recoupable/api", number: 42, url: "url", baseBranch: "test" }],
    });

    expect(mockDeletePRState).toHaveBeenCalledWith("recoupable/api", "agent/fix-bug");
  });

  it("deletes PR state for all repos when PRs span multiple repos", async () => {
    await handleMergeSuccess({
      status: "pr_created",
      branch: "agent/fix-bug",
      prs: [
        { repo: "recoupable/api", number: 42, url: "url", baseBranch: "test" },
        { repo: "recoupable/chat", number: 10, url: "url", baseBranch: "test" },
        { repo: "recoupable/api", number: 43, url: "url", baseBranch: "test" },
      ],
    });

    expect(mockDeletePRState).toHaveBeenCalledTimes(2);
    expect(mockDeletePRState).toHaveBeenCalledWith("recoupable/api", "agent/fix-bug");
    expect(mockDeletePRState).toHaveBeenCalledWith("recoupable/chat", "agent/fix-bug");
  });

  it("does not throw when deleteCodingAgentPRState throws", async () => {
    mockDeletePRState.mockRejectedValue(new Error("Redis connection failed"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      handleMergeSuccess({
        status: "pr_created",
        branch: "agent/fix-bug",
        prs: [{ repo: "recoupable/api", number: 42, url: "url", baseBranch: "test" }],
      }),
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      "[coding-agent] post-merge cleanup failed:",
      expect.any(Error),
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
