import { describe, it, expect, vi, beforeEach } from "vitest";

global.fetch = vi.fn();

const mockDeletePRState = vi.fn();
vi.mock("../prState", () => ({
  deleteCodingAgentPRState: (...args: unknown[]) => mockDeletePRState(...args),
}));

const { registerOnMergeAction } = await import("../handlers/onMergeAction");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = "ghp_test";
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

  it("squash-merges PRs, cleans up shared state, and posts results", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);

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

    await handler({ thread: mockThread });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/recoupable/api/pulls/42/merge",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(mockThread.setState).toHaveBeenCalledWith({ status: "merged" });
    expect(mockDeletePRState).toHaveBeenCalledWith("recoupable/api", "agent/fix-bug");
    expect(mockThread.post).toHaveBeenCalledWith(expect.stringContaining("merged"));
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
  });
});
