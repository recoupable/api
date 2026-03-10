import { describe, it, expect, vi, beforeEach } from "vitest";

const mockMergeGithubBranch = vi.fn();
vi.mock("../mergeGithubBranch", () => ({
  mergeGithubBranch: (...args: unknown[]) => mockMergeGithubBranch(...args),
}));

const { registerOnMergeTestToMainAction, parseMergeTestToMainActionId } = await import(
  "../handlers/onMergeTestToMainAction"
);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = "ghp_test";
});

function createMockBot() {
  return { onAction: vi.fn() } as any;
}

describe("parseMergeTestToMainActionId", () => {
  it("parses a valid action ID", () => {
    expect(parseMergeTestToMainActionId("merge_test_to_main:recoupable/api")).toBe("recoupable/api");
  });

  it("returns null for invalid format", () => {
    expect(parseMergeTestToMainActionId("merge_test_to_main:")).toBeNull();
    expect(parseMergeTestToMainActionId("merge_test_to_main:noslash")).toBeNull();
    expect(parseMergeTestToMainActionId("other_action:repo/name")).toBeNull();
  });
});

describe("registerOnMergeTestToMainAction", () => {
  it("registers merge_test_to_main: action handler", () => {
    const bot = createMockBot();
    registerOnMergeTestToMainAction(bot);
    expect(bot.onAction).toHaveBeenCalledWith("merge_test_to_main:", expect.any(Function));
  });

  it("merges test to main and posts success", async () => {
    mockMergeGithubBranch.mockResolvedValue({ ok: true });

    const bot = createMockBot();
    registerOnMergeTestToMainAction(bot);
    const handler = bot.onAction.mock.calls[0][1];

    const mockThread = { post: vi.fn() };

    await handler({ thread: mockThread, actionId: "merge_test_to_main:recoupable/chat" });

    expect(mockMergeGithubBranch).toHaveBeenCalledWith("recoupable/chat", "test", "main", "ghp_test");
    expect(mockThread.post).toHaveBeenCalledWith("✅ Merged test → main for recoupable/chat.");
  });

  it("posts error message on failure", async () => {
    mockMergeGithubBranch.mockResolvedValue({ ok: false, message: "Merge conflict" });

    const bot = createMockBot();
    registerOnMergeTestToMainAction(bot);
    const handler = bot.onAction.mock.calls[0][1];

    const mockThread = { post: vi.fn() };

    await handler({ thread: mockThread, actionId: "merge_test_to_main:recoupable/api" });

    expect(mockThread.post).toHaveBeenCalledWith(
      "❌ Failed to merge test → main for recoupable/api: Merge conflict",
    );
  });

  it("posts missing token message when GITHUB_TOKEN is not set", async () => {
    delete process.env.GITHUB_TOKEN;

    const bot = createMockBot();
    registerOnMergeTestToMainAction(bot);
    const handler = bot.onAction.mock.calls[0][1];

    const mockThread = { post: vi.fn() };

    await handler({ thread: mockThread, actionId: "merge_test_to_main:recoupable/api" });

    expect(mockThread.post).toHaveBeenCalledWith("Missing GITHUB_TOKEN — cannot merge branches.");
    expect(mockMergeGithubBranch).not.toHaveBeenCalled();
  });
});
