import { describe, it, expect, vi, beforeEach } from "vitest";

const mockMergeGithubPR = vi.fn();
vi.mock("../mergeGithubPR", () => ({
  mergeGithubPR: (...args: unknown[]) => mockMergeGithubPR(...args),
}));

const mockHandleMergeSuccess = vi.fn();
vi.mock("../handleMergeSuccess", () => ({
  handleMergeSuccess: (...args: unknown[]) => mockHandleMergeSuccess(...args),
}));

const mockDeletePRState = vi.fn();
vi.mock("../prState", () => ({
  deleteCodingAgentPRState: (...args: unknown[]) => mockDeletePRState(...args),
}));

const mockUpsertAccountSnapshot = vi.fn();
vi.mock("@/lib/supabase/account_snapshots/upsertAccountSnapshot", () => ({
  upsertAccountSnapshot: (...args: unknown[]) => mockUpsertAccountSnapshot(...args),
}));

const { registerOnMergeAction } = await import("../handlers/onMergeAction");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = "ghp_test";
  mockHandleMergeSuccess.mockResolvedValue(undefined);
  mockUpsertAccountSnapshot.mockResolvedValue({ data: {}, error: null });
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
  it("registers catch-all action handler", () => {
    const bot = createMockBot();
    registerOnMergeAction(bot);
    expect(bot.onAction).toHaveBeenCalledWith(expect.any(Function));
  });

  it("ignores non-merge actions", async () => {
    const bot = createMockBot();
    registerOnMergeAction(bot);
    const handler = bot.onAction.mock.calls[0][0];

    const mockThread = {
      state: Promise.resolve({ status: "pr_created", prompt: "fix bug", prs: [] }),
      post: vi.fn(),
      setState: vi.fn(),
    };

    await handler({ thread: mockThread, actionId: "some_other_action" });

    expect(mockThread.post).not.toHaveBeenCalled();
  });

  it("squash-merges a single PR, calls handleMergeSuccess, and posts result", async () => {
    mockMergeGithubPR.mockResolvedValue({ ok: true });

    const bot = createMockBot();
    registerOnMergeAction(bot);
    const handler = bot.onAction.mock.calls[0][0];

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

    expect(mockMergeGithubPR).toHaveBeenCalledWith("recoupable/api", 42, "ghp_test");
    expect(mockThread.setState).toHaveBeenCalledWith({ status: "merged", prs: [] });
    expect(mockHandleMergeSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ branch: "agent/fix-bug", snapshotId: "snap_abc123" }),
    );
    expect(mockThread.post).toHaveBeenCalledWith("✅ recoupable/api#42 merged.");
  });

  it("merges one PR and keeps remaining PRs in state without calling handleMergeSuccess", async () => {
    mockMergeGithubPR.mockResolvedValue({ ok: true });

    const bot = createMockBot();
    registerOnMergeAction(bot);
    const handler = bot.onAction.mock.calls[0][0];

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
    const handler = bot.onAction.mock.calls[0][0];

    const mockThread = {
      state: Promise.resolve({ status: "pr_created", prompt: "fix bug", prs: [] }),
      post: vi.fn(),
      setState: vi.fn(),
    };

    await handler({ thread: mockThread, actionId: "merge_pr:recoupable/api#99" });

    expect(mockThread.post).toHaveBeenCalledWith("PR recoupable/api#99 not found in this thread.");
    expect(mockMergeGithubPR).not.toHaveBeenCalled();
    expect(mockHandleMergeSuccess).not.toHaveBeenCalled();
  });

  it("posts error message when merge fails", async () => {
    mockMergeGithubPR.mockResolvedValue({ ok: false, message: "Not allowed" });

    const bot = createMockBot();
    registerOnMergeAction(bot);
    const handler = bot.onAction.mock.calls[0][0];

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
  });

  it("merge button click triggers snapshot upsert in Supabase via handleMergeSuccess", async () => {
    // Use the real handleMergeSuccess instead of the mock to verify the full chain
    const { handleMergeSuccess: realHandleMergeSuccess } = await vi.importActual<
      typeof import("../handleMergeSuccess")
    >("../handleMergeSuccess");
    mockHandleMergeSuccess.mockImplementation(realHandleMergeSuccess);
    mockMergeGithubPR.mockResolvedValue({ ok: true });

    const bot = createMockBot();
    registerOnMergeAction(bot);
    const handler = bot.onAction.mock.calls[0][0];

    const state = {
      status: "pr_created" as const,
      prompt: "fix bug",
      branch: "agent/fix-bug",
      snapshotId: "snap_abc123",
      prs: [{ repo: "recoupable/api", number: 42, url: "url", baseBranch: "test" }],
    };

    const mockThread = {
      state: Promise.resolve(state),
      post: vi.fn(),
      setState: vi.fn(),
    };

    await handler({ thread: mockThread, actionId: "merge_pr:recoupable/api#42" });

    // Verify the full chain: merge → handleMergeSuccess → upsertAccountSnapshot
    expect(mockMergeGithubPR).toHaveBeenCalledWith("recoupable/api", 42, "ghp_test");
    expect(mockDeletePRState).toHaveBeenCalledWith("recoupable/api", "agent/fix-bug");
    expect(mockUpsertAccountSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot_id: "snap_abc123",
        expires_at: expect.any(String),
      }),
    );
  });
});
