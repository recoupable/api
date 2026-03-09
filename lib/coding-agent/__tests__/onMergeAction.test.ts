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
  it("registers merge_pr: action handler with prefix pattern", () => {
    const bot = createMockBot();
    registerOnMergeAction(bot);
    expect(bot.onAction).toHaveBeenCalledWith("merge_pr:", expect.any(Function));
  });

  it("squash-merges a single PR, calls handleMergeSuccess, and posts result", async () => {
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

    await handler({ thread: mockThread, actionId: "merge_pr:recoupable/api#42" });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/recoupable/api/pulls/42/merge",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(mockThread.setState).toHaveBeenCalledWith({ status: "merged", prs: [] });
    expect(mockHandleMergeSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ branch: "agent/fix-bug", snapshotId: "snap_abc123" }),
    );
    expect(mockThread.post).toHaveBeenCalledWith("✅ recoupable/api#42 merged.");
  });

  it("merges one PR and keeps remaining PRs in state without calling handleMergeSuccess", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);

    const bot = createMockBot();
    registerOnMergeAction(bot);
    const handler = bot.onAction.mock.calls[0][1];

    const mockThread = {
      state: Promise.resolve({
        status: "pr_created",
        prompt: "fix bug",
        branch: "agent/fix-bug",
        prs: [
          { repo: "recoupable/api", number: 42, url: "url1", baseBranch: "test" },
          { repo: "recoupable/chat", number: 10, url: "url2", baseBranch: "test" },
        ],
      }),
      post: vi.fn(),
      setState: vi.fn(),
    };

    await handler({ thread: mockThread, actionId: "merge_pr:recoupable/api#42" });

    expect(mockThread.setState).toHaveBeenCalledWith({
      status: "pr_created",
      prs: [{ repo: "recoupable/chat", number: 10, url: "url2", baseBranch: "test" }],
    });
    expect(mockHandleMergeSuccess).not.toHaveBeenCalled();
    expect(mockThread.post).toHaveBeenCalledWith("✅ recoupable/api#42 merged.");
  });

  it("posts not found message when PR is not in thread state", async () => {
    const bot = createMockBot();
    registerOnMergeAction(bot);
    const handler = bot.onAction.mock.calls[0][1];

    const mockThread = {
      state: Promise.resolve({ status: "pr_created", prompt: "fix bug", prs: [] }),
      post: vi.fn(),
      setState: vi.fn(),
    };

    await handler({ thread: mockThread, actionId: "merge_pr:recoupable/api#99" });

    expect(mockThread.post).toHaveBeenCalledWith("PR recoupable/api#99 not found in this thread.");
    expect(fetch).not.toHaveBeenCalled();
    expect(mockHandleMergeSuccess).not.toHaveBeenCalled();
  });

  it("posts error message when merge fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 405,
      text: () => Promise.resolve(JSON.stringify({ message: "Not allowed" })),
    } as any);

    const bot = createMockBot();
    registerOnMergeAction(bot);
    const handler = bot.onAction.mock.calls[0][1];

    const mockThread = {
      state: Promise.resolve({
        status: "pr_created",
        prompt: "fix bug",
        branch: "agent/fix-bug",
        prs: [{ repo: "recoupable/api", number: 42, url: "url", baseBranch: "test" }],
      }),
      post: vi.fn(),
      setState: vi.fn(),
    };

    await handler({ thread: mockThread, actionId: "merge_pr:recoupable/api#42" });

    expect(mockHandleMergeSuccess).not.toHaveBeenCalled();
    expect(mockThread.post).toHaveBeenCalledWith("❌ recoupable/api#42 failed to merge: Not allowed");
    consoleSpy.mockRestore();
  });
});
