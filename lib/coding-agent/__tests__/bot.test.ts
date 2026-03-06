import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@chat-adapter/slack", () => ({
  SlackAdapter: vi.fn().mockImplementation(() => ({
    name: "slack",
  })),
}));

vi.mock("@chat-adapter/github", () => ({
  GitHubAdapter: vi.fn().mockImplementation(() => ({
    name: "github",
  })),
}));

vi.mock("@chat-adapter/state-ioredis", () => ({
  createIoRedisState: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

vi.mock("@/lib/redis/connection", () => ({
  default: {},
}));

vi.mock("chat", () => ({
  Chat: vi.fn().mockImplementation((config: Record<string, unknown>) => {
    const instance = {
      ...config,
      webhooks: {},
      onNewMention: vi.fn(),
      onSubscribedMessage: vi.fn(),
      onAction: vi.fn(),
      registerSingleton: vi.fn().mockReturnThis(),
    };
    instance.registerSingleton = vi.fn().mockReturnValue(instance);
    return instance;
  }),
}));

describe("createCodingAgentBot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SLACK_BOT_TOKEN = "xoxb-test";
    process.env.SLACK_SIGNING_SECRET = "test-signing-secret";
    process.env.GITHUB_TOKEN = "ghp_test";
    process.env.GITHUB_WEBHOOK_SECRET = "test-webhook-secret";
    process.env.GITHUB_BOT_USERNAME = "recoup-bot";
  });

  it("creates a Chat instance with slack and github adapters", async () => {
    const { Chat } = await import("chat");
    const { createCodingAgentBot } = await import("../bot");

    createCodingAgentBot();

    expect(Chat).toHaveBeenCalled();
    const lastCall = vi.mocked(Chat).mock.calls.at(-1)!;
    const config = lastCall[0];
    expect(config.adapters).toHaveProperty("slack");
    expect(config.adapters).toHaveProperty("github");
  });

  it("creates a SlackAdapter with correct config", async () => {
    const { SlackAdapter } = await import("@chat-adapter/slack");
    const { createCodingAgentBot } = await import("../bot");

    createCodingAgentBot();

    expect(SlackAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        botToken: "xoxb-test",
        signingSecret: "test-signing-secret",
      }),
    );
  });

  it("creates a GitHubAdapter with correct config", async () => {
    const { GitHubAdapter } = await import("@chat-adapter/github");
    const { createCodingAgentBot } = await import("../bot");

    createCodingAgentBot();

    expect(GitHubAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "ghp_test",
        webhookSecret: "test-webhook-secret",
        userName: "recoup-bot",
      }),
    );
  });

  it("uses ioredis state adapter with existing Redis client", async () => {
    const { createIoRedisState } = await import("@chat-adapter/state-ioredis");
    const redis = (await import("@/lib/redis/connection")).default;
    const { createCodingAgentBot } = await import("../bot");

    createCodingAgentBot();

    expect(createIoRedisState).toHaveBeenCalledWith(
      expect.objectContaining({
        client: redis,
        keyPrefix: "coding-agent",
      }),
    );
  });

  it("sets userName to Recoup Agent", async () => {
    const { Chat } = await import("chat");
    const { createCodingAgentBot } = await import("../bot");

    createCodingAgentBot();

    const lastCall = vi.mocked(Chat).mock.calls.at(-1)!;
    expect(lastCall[0].userName).toBe("Recoup Agent");
  });
});
