import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/trigger/triggerCodingAgent", () => ({
  triggerCodingAgent: vi.fn().mockResolvedValue({ id: "run_123" }),
}));

const { registerOnNewMention } = await import("../handlers/onNewMention");

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 *
 */
function createMockBot() {
  return {
    onNewMention: vi.fn(),
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
