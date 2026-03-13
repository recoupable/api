import { Chat, ConsoleLogger } from "chat";
import { SlackAdapter } from "@chat-adapter/slack";
import { createIoRedisState } from "@chat-adapter/state-ioredis";
import redis from "@/lib/redis/connection";
import type { SlackChatThreadState } from "./types";
import { validateSlackChatEnv } from "./validateEnv";

const logger = new ConsoleLogger();

type SlackChatAdapters = {
  slack: SlackAdapter;
};

/**
 * Creates a new Chat bot instance configured with a single Slack adapter
 * for the Record Label Agent.
 *
 * @returns A configured Chat instance
 */
export function createSlackChatBot() {
  validateSlackChatEnv();

  if (redis.status === "wait") {
    redis.connect().catch(() => {
      throw new Error("[slack-chat] Redis failed to connect");
    });
  }

  const state = createIoRedisState({
    client: redis,
    keyPrefix: "chat",
    logger,
  });

  const slack = new SlackAdapter({
    botToken: process.env.SLACK_CHAT_BOT_TOKEN!,
    signingSecret: process.env.SLACK_CHAT_SIGNING_SECRET!,
    logger,
  });

  return new Chat<SlackChatAdapters, SlackChatThreadState>({
    userName: "Record Label Agent",
    adapters: { slack },
    state,
  });
}

export type SlackChatBot = ReturnType<typeof createSlackChatBot>;

/**
 * Singleton bot instance.
 * Does NOT call registerSingleton() to avoid conflicting with the coding-agent bot.
 */
export const slackChatBot = createSlackChatBot();
