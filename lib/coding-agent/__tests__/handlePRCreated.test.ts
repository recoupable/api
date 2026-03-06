import { describe, it, expect, vi } from "vitest";

const mockThread = {
  post: vi.fn(),
  setState: vi.fn(),
};

vi.mock("../getThread", () => ({
  getThread: vi.fn(() => mockThread),
}));

describe("handlePRCreated", () => {
  it("posts PR links and updates thread state", async () => {
    const { handlePRCreated } = await import("../handlePRCreated");

    await handlePRCreated("slack:C123:ts", {
      threadId: "slack:C123:ts",
      status: "pr_created",
      branch: "agent/fix-bug",
      snapshotId: "snap_abc",
      prs: [{ repo: "recoupable/api", number: 42, url: "https://github.com/recoupable/api/pull/42", baseBranch: "test" }],
    });

    expect(mockThread.post).toHaveBeenCalledWith(expect.stringContaining("recoupable/api#42"));
    expect(mockThread.setState).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pr_created",
        branch: "agent/fix-bug",
        snapshotId: "snap_abc",
      }),
    );
  });
});
