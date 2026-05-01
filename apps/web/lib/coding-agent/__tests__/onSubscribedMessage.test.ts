import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/trigger/triggerUpdatePR", () => ({
  triggerUpdatePR: vi.fn().mockResolvedValue({ id: "run_456" }),
}));

vi.mock("../prState", () => ({
  setCodingAgentPRState: vi.fn(),
}));

const { registerOnSubscribedMessage } = await import("../handlers/onSubscribedMessage");

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 *
 */
function createMockBot() {
  return {
    onSubscribedMessage: vi.fn(),
  } as any;
}

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
        prs: [{ repo: "recoupable/api", number: 1, url: "url", baseBranch: "test" }],
      }),
      post: vi.fn(),
      setState: vi.fn(),
    };

    await handler(mockThread, { text: "make the button blue", author: { userId: "U111" } });

    expect(mockThread.post).toHaveBeenCalledWith(
      expect.objectContaining({ card: expect.anything() }),
    );
    expect(mockThread.setState).toHaveBeenCalledWith(
      expect.objectContaining({ status: "updating" }),
    );
    expect(triggerUpdatePR).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback: "make the button blue",
        snapshotId: "snap_abc",
        repo: "recoupable/api",
      }),
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

    await handler(mockThread, { text: "hurry up", author: { userId: "U111" } });

    expect(mockThread.post).toHaveBeenCalledWith(expect.stringContaining("still working"));
  });
});
