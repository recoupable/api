import { describe, it, expect, vi, beforeEach } from "vitest";

global.fetch = vi.fn();

const mockHandleMergeSuccess = vi.fn();
vi.mock("../handleMergeSuccess", () => ({
  handleMergeSuccess: (...args: unknown[]) => mockHandleMergeSuccess(...args),
}));

const { registerOnMergeAction } = await import("../handlers/onMergeAction");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = "ghp_test";
  mockHandleMergeSuccess.mockResolvedValue(undefined);
});

/**
 *
 */
function createMockBot() {
  return {
    onAction: vi.fn(),
  } as any;
}

describe("registerOnMergeAction", () => {
  it("registers merge_all_prs action handler", () => {
    const bot = createMockBot();
    registerOnMergeAction(bot);
    expect(bot.onAction).toHaveBeenCalledWith("merge_all_prs", expect.any(Function));
  });

  it("squash-merges PRs, calls handleMergeSuccess, and posts results", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);

    const bot = createMockBot();
    registerOnMergeAction(bot);
    const handler = bot.onAction.mock.calls[0][1];

    const mockThread = {
      state: Promise.resolve({
        status: "pr_created",
        prompt: "fix bug",
        branch: "agent/fix-bug",
        snapshotId: "snap_abc123",
        prs: [{ repo: "recoupable/api", number: 42, url: "url", baseBranch: "test" }],
      }),
      post: vi.fn(),
      setState: vi.fn(),
    };

    await handler({ thread: mockThread });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/recoupable/api/pulls/42/merge",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(mockThread.setState).toHaveBeenCalledWith({ status: "merged" });
    expect(mockHandleMergeSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ branch: "agent/fix-bug", snapshotId: "snap_abc123" }),
    );
    expect(mockThread.post).toHaveBeenCalledWith(expect.stringContaining("merged"));
  });

  it("does not call handleMergeSuccess when a merge fails", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 409,
      text: () => Promise.resolve(JSON.stringify({ message: "merge conflict" })),
    } as unknown as Response);

    const bot = createMockBot();
    registerOnMergeAction(bot);
    const handler = bot.onAction.mock.calls[0][1];
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mockThread = {
      state: Promise.resolve({
        status: "pr_created",
        prompt: "fix bug",
        branch: "agent/fix-bug",
        snapshotId: "snap_abc123",
        prs: [{ repo: "recoupable/api", number: 42, url: "url", baseBranch: "test" }],
      }),
      post: vi.fn(),
      setState: vi.fn(),
    };

    await handler({ thread: mockThread });

    expect(mockHandleMergeSuccess).not.toHaveBeenCalled();
    expect(mockThread.setState).toHaveBeenCalledWith({ status: "pr_created" });
    expect(mockThread.post).toHaveBeenCalledWith(expect.stringContaining("failed"));
    consoleSpy.mockRestore();
  });

  it("posts no PRs message when state has no PRs", async () => {
    const bot = createMockBot();
    registerOnMergeAction(bot);
    const handler = bot.onAction.mock.calls[0][1];

    const mockThread = {
      state: Promise.resolve({ status: "pr_created", prompt: "fix bug" }),
      post: vi.fn(),
      setState: vi.fn(),
    };

    await handler({ thread: mockThread });

    expect(mockThread.post).toHaveBeenCalledWith("No PRs to merge.");
    expect(fetch).not.toHaveBeenCalled();
    expect(mockHandleMergeSuccess).not.toHaveBeenCalled();
  });
});
