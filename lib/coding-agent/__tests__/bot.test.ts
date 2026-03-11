import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@chat-adapter/slack", () => ({
  SlackAdapter: vi.fn().mockImplementation(() => ({
    name: "slack",
  })),
}));

vi.mock("@chat-adapter/github", () => ({
  createGitHubAdapter: vi.fn().mockReturnValue({
    name: "github",
  }),
}));

vi.mock("@resend/chat-sdk-adapter", () => ({
  createResendAdapter: vi.fn().mockReturnValue({
    name: "resend",
  }),
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
  ConsoleLogger: vi.fn(),
}));

describe("createCodingAgentBot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SLACK_BOT_TOKEN = "xoxb-test";
    process.env.SLACK_SIGNING_SECRET = "test-signing-secret";
    process.env.GITHUB_TOKEN = "ghp_test";
    process.env.GITHUB_WEBHOOK_SECRET = "test-webhook-secret";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.CODING_AGENT_CALLBACK_SECRET = "test-callback-secret";
  });

  it("creates a Chat instance with slack adapter", async () => {
    const { Chat } = await import("chat");
    const { createCodingAgentBot } = await import("../bot");

    createCodingAgentBot();

    expect(Chat).toHaveBeenCalled();
    const lastCall = vi.mocked(Chat).mock.calls.at(-1)!;
    const config = lastCall[0];
    expect(config.adapters).toHaveProperty("slack");
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

  it("creates a Chat instance with github adapter", async () => {
    const { Chat } = await import("chat");
    const { createCodingAgentBot } = await import("../bot");

    createCodingAgentBot();

    const lastCall = vi.mocked(Chat).mock.calls.at(-1)!;
    const config = lastCall[0];
    expect(config.adapters).toHaveProperty("github");
  });

  it("creates GitHub adapter with correct config", async () => {
    const { createGitHubAdapter } = await import("@chat-adapter/github");
    const { createCodingAgentBot } = await import("../bot");

    createCodingAgentBot();

    expect(createGitHubAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "ghp_test",
        webhookSecret: "test-webhook-secret",
        userName: "recoup-coding-agent",
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

  it("creates a Chat instance with resend adapter", async () => {
    const { Chat } = await import("chat");
    const { createCodingAgentBot } = await import("../bot");

    createCodingAgentBot();

    const lastCall = vi.mocked(Chat).mock.calls.at(-1)!;
    const config = lastCall[0];
    expect(config.adapters).toHaveProperty("resend");
  });

  it("creates Resend adapter with correct from address", async () => {
    const { createResendAdapter } = await import("@resend/chat-sdk-adapter");
    const { createCodingAgentBot } = await import("../bot");

    createCodingAgentBot();

    expect(createResendAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        fromAddress: "agent@recoupable.com",
        fromName: "Recoup Agent",
      }),
    );
  });
});
