import { Chat, ConsoleLogger } from "chat";
import { SlackAdapter } from "@chat-adapter/slack";
import { GitHubAdapter } from "@chat-adapter/github";
import { createIoRedisState } from "@chat-adapter/state-ioredis";
import redis from "@/lib/redis/connection";
import type { CodingAgentThreadState } from "./types";

const logger = new ConsoleLogger();

/**
 * Creates a new Chat bot instance configured with Slack and GitHub adapters.
 */
export function createCodingAgentBot() {
  // ioredis is configured with lazyConnect: true, so we must
  // explicitly connect before the state adapter listens for "ready".
  if (redis.status === "wait") {
    redis.connect().catch(err => console.error("[coding-agent] Redis connect error:", err));
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

  const github = new GitHubAdapter({
    token: process.env.GITHUB_TOKEN!,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET!,
    userName: process.env.GITHUB_BOT_USERNAME!,
    logger,
  });

  return new Chat<{ slack: SlackAdapter; github: GitHubAdapter }, CodingAgentThreadState>({
    userName: "Recoup Agent",
    adapters: { slack, github },
    state,
  });
}

export type CodingAgentBot = ReturnType<typeof createCodingAgentBot>;

/**
 * Singleton bot instance. Registers as the Chat SDK singleton
 * so ThreadImpl can resolve adapters lazily from thread IDs.
 */
export const codingAgentBot = createCodingAgentBot().registerSingleton();
