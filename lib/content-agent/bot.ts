import { Chat, ConsoleLogger } from "chat";
import { SlackAdapter } from "@chat-adapter/slack";
import { createIoRedisState } from "@chat-adapter/state-ioredis";
import redis from "@/lib/redis/connection";
import type { ContentAgentThreadState } from "./types";
import { validateContentAgentEnv } from "./validateEnv";

const logger = new ConsoleLogger();

type ContentAgentAdapters = {
  slack: SlackAdapter;
};

/**
 * Creates a new Chat bot instance configured with the Slack adapter
 * for the Recoup Content Agent.
 *
 * @returns The configured Chat bot instance
 */
export function createContentAgentBot() {
  validateContentAgentEnv();

  if (redis.status === "wait") {
    redis.connect().catch(() => {
      throw new Error("[content-agent] Redis failed to connect");
    });
  }

  const state = createIoRedisState({
    client: redis,
    keyPrefix: "content-agent",
    logger,
  });

  const slack = new SlackAdapter({
    botToken: process.env.SLACK_CONTENT_BOT_TOKEN!,
    signingSecret: process.env.SLACK_CONTENT_SIGNING_SECRET!,
    logger,
  });

  return new Chat<ContentAgentAdapters, ContentAgentThreadState>({
    userName: "Recoup Content Agent",
    adapters: { slack },
    state,
  });
}

export type ContentAgentBot = ReturnType<typeof createContentAgentBot>;

let _bot: ContentAgentBot | null = null;

/**
 * Returns the lazily-initialized content agent bot singleton.
 * Defers creation until first call so the Vercel build does not
 * crash when content-agent env vars are not yet configured.
 *
 * @returns The content agent bot singleton
 */
export function getContentAgentBot(): ContentAgentBot {
  if (!_bot) {
    _bot = createContentAgentBot().registerSingleton();
  }
  return _bot;
}
