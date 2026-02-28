import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/trigger/triggerCodingAgent", () => ({
  triggerCodingAgent: vi.fn().mockResolvedValue({ id: "run_123" }),
}));

vi.mock("@/lib/trigger/triggerUpdatePR", () => ({
  triggerUpdatePR: vi.fn().mockResolvedValue({ id: "run_456" }),
}));

const { registerOnNewMention } = await import("../handlers/onNewMention");
const { registerOnSubscribedMessage } = await import("../handlers/onSubscribedMessage");
const { registerOnMergeAction } = await import("../handlers/onMergeAction");

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 *
 */
function createMockBot() {
  return {
    onNewMention: vi.fn(),
    onSubscribedMessage: vi.fn(),
    onAction: vi.fn(),
  } as any;
}

describe("registerOnNewMention", () => {
  it("registers a handler on the bot", () => {
    const bot = createMockBot();
    registerOnNewMention(bot);
    expect(bot.onNewMention).toHaveBeenCalledOnce();
  });

  it("posts acknowledgment and triggers coding agent task", async () => {
    process.env.CODING_AGENT_CHANNELS = "";
    process.env.CODING_AGENT_USERS = "";

    const bot = createMockBot();
    registerOnNewMention(bot);
    const handler = bot.onNewMention.mock.calls[0][0];

    const mockThread = {
      id: "slack:C123:1234567890.123456",
      subscribe: vi.fn(),
      post: vi.fn(),
      setState: vi.fn(),
    };
    const mockMessage = {
      text: "fix the login bug in the api",
      author: { id: "U111" },
    };

    await handler(mockThread, mockMessage);

    expect(mockThread.subscribe).toHaveBeenCalledOnce();
    expect(mockThread.post).toHaveBeenCalledWith(expect.stringContaining("Starting work"));
    expect(mockThread.setState).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "running",
        prompt: "fix the login bug in the api",
      }),
    );
  });

  it("rejects mentions from non-allowed channels", async () => {
    process.env.CODING_AGENT_CHANNELS = "C999";
    process.env.CODING_AGENT_USERS = "";

    const bot = createMockBot();
    registerOnNewMention(bot);
    const handler = bot.onNewMention.mock.calls[0][0];

    const mockThread = {
      id: "slack:C123:1234567890.123456",
      subscribe: vi.fn(),
      post: vi.fn(),
      setState: vi.fn(),
    };

    await handler(mockThread, { text: "hi", author: { id: "U111" } });

    expect(mockThread.subscribe).not.toHaveBeenCalled();
  });
});

describe("registerOnSubscribedMessage", () => {
  it("registers a handler on the bot", () => {
    const bot = createMockBot();
    registerOnSubscribedMessage(bot);
    expect(bot.onSubscribedMessage).toHaveBeenCalledOnce();
  });

  it("triggers update PR task when status is pr_created", async () => {
    const { triggerUpdatePR } = await import("@/lib/trigger/triggerUpdatePR");

    const bot = createMockBot();
    registerOnSubscribedMessage(bot);
    const handler = bot.onSubscribedMessage.mock.calls[0][0];

    const mockThread = {
      id: "slack:C123:1234567890.123456",
      state: Promise.resolve({
        status: "pr_created",
        prompt: "fix bug",
        snapshotId: "snap_abc",
        branch: "agent/fix-bug",
        prs: [{ repo: "recoupable/recoup-api", number: 1, url: "url", baseBranch: "test" }],
      }),
      post: vi.fn(),
      setState: vi.fn(),
    };

    await handler(mockThread, { text: "make the button blue", author: { id: "U111" } });

    expect(triggerUpdatePR).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback: "make the button blue",
        snapshotId: "snap_abc",
      }),
    );
    expect(mockThread.setState).toHaveBeenCalledWith(
      expect.objectContaining({ status: "updating" }),
    );
  });

  it("tells user to wait when agent is running", async () => {
    const bot = createMockBot();
    registerOnSubscribedMessage(bot);
    const handler = bot.onSubscribedMessage.mock.calls[0][0];

    const mockThread = {
      id: "slack:C123:1234567890.123456",
      state: Promise.resolve({ status: "running", prompt: "fix bug" }),
      post: vi.fn(),
      setState: vi.fn(),
    };

    await handler(mockThread, { text: "hurry up", author: { id: "U111" } });

    expect(mockThread.post).toHaveBeenCalledWith(expect.stringContaining("still working"));
  });
});

describe("registerOnMergeAction", () => {
  it("registers merge_all_prs action handler", () => {
    const bot = createMockBot();
    registerOnMergeAction(bot);
    expect(bot.onAction).toHaveBeenCalledWith("merge_all_prs", expect.any(Function));
  });
});
