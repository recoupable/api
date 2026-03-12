import { Chat, ConsoleLogger } from "chat";
import { SlackAdapter } from "@chat-adapter/slack";
import { createWhatsAppAdapter, WhatsAppAdapter } from "@chat-adapter/whatsapp";
import { createIoRedisState } from "@chat-adapter/state-ioredis";
import redis from "@/lib/redis/connection";
import type { CodingAgentThreadState } from "./types";
import { validateCodingAgentEnv } from "./validateEnv";

const logger = new ConsoleLogger();

type CodingAgentAdapters = {
  slack: SlackAdapter;
  whatsapp: WhatsAppAdapter;
};

/**
 * Creates a new Chat bot instance configured with Slack and WhatsApp adapters.
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

  const whatsapp = createWhatsAppAdapter({ logger });

  return new Chat<CodingAgentAdapters, CodingAgentThreadState>({
    userName: "Recoup Agent",
    adapters: { slack, whatsapp },
    state,
  });
}

export type CodingAgentBot = ReturnType<typeof createCodingAgentBot>;

/**
 * Singleton bot instance. Registers as the Chat SDK singleton
 * so ThreadImpl can resolve adapters lazily from thread IDs.
 */
export const codingAgentBot = createCodingAgentBot().registerSingleton();
