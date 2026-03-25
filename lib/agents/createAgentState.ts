import { ConsoleLogger } from "chat";
import { createIoRedisState } from "@chat-adapter/state-ioredis";
import redis from "@/lib/redis/connection";

/**
 * Shared logger for all agent bots.
 */
export const agentLogger = new ConsoleLogger();

/**
 * Creates a Redis-backed state adapter for an agent bot.
 * Handles the Redis connection lifecycle and returns an ioredis state instance.
 *
 * @param keyPrefix - The Redis key prefix for this agent (e.g. "coding-agent", "content-agent")
 * @returns The ioredis state adapter
 */
export function createAgentState(keyPrefix: string) {
  if (redis.status === "wait") {
    redis.connect().catch(err => {
      console.error(`[${keyPrefix}] Redis failed to connect:`, err);
    });
  }

  return createIoRedisState({
    client: redis,
    keyPrefix,
    logger: agentLogger,
  });
}
