import { Chat, ConsoleLogger } from "chat";
import { SlackAdapter } from "@chat-adapter/slack";
import { createGitHubAdapter } from "@chat-adapter/github";
import { createResendAdapter } from "@resend/chat-sdk-adapter";
import { createIoRedisState } from "@chat-adapter/state-ioredis";
import redis from "@/lib/redis/connection";
import type { CodingAgentThreadState } from "./types";
import { validateCodingAgentEnv } from "./validateEnv";
import { CODING_AGENT_FROM_EMAIL } from "./const";

const logger = new ConsoleLogger();

/**
 * Creates a new Chat bot instance configured with the Slack adapter.
 */
export function createCodingAgentBot() {
  validateCodingAgentEnv();
  // ioredis is configured with lazyConnect: true, so we must
  // explicitly connect before the state adapter listens for "ready".
  if (redis.status === "wait") {
    redis.connect().catch(() => {
      throw new Error("[coding-agent] Redis failed to connect");
    });
  }

  const state = createIoRedisState({
    client: redis,
    keyPrefix: "coding-agent",
    logger,
  });

  const slack = new SlackAdapter({
    botToken: process.env.SLACK_BOT_TOKEN!,
    signingSecret: process.env.SLACK_SIGNING_SECRET!,
    logger,
  });

  const github = createGitHubAdapter({
    token: process.env.GITHUB_TOKEN!,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET!,
    userName: process.env.GITHUB_BOT_USERNAME ?? "recoup-coding-agent",
    logger,
  });

  const resend = createResendAdapter({
    fromAddress: CODING_AGENT_FROM_EMAIL,
    fromName: "Recoup Agent",
  });

  return new Chat<{
    slack: SlackAdapter;
    github: ReturnType<typeof createGitHubAdapter>;
    resend: ReturnType<typeof createResendAdapter>;
  }, CodingAgentThreadState>({
    userName: "Recoup Agent",
    adapters: { slack, github, resend },
    state,
  });
}

export type CodingAgentBot = ReturnType<typeof createCodingAgentBot>;

/**
 * Singleton bot instance. Registers as the Chat SDK singleton
 * so ThreadImpl can resolve adapters lazily from thread IDs.
 */
export const codingAgentBot = createCodingAgentBot().registerSingleton();
