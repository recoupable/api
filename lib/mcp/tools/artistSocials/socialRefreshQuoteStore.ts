import { randomUUID } from "node:crypto";
import { Redis } from "ioredis";

const QUOTE_TTL_SECONDS = 600;
// Longer than the MCP route's 800-second maximum duration.
const EXECUTION_TTL_SECONDS = 900;
const claim = `
  if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
  if not redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3], 'NX') then return 1 end
  redis.call('DEL', KEYS[1])
  return 2
`;
const release = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
  return 0
`;

/** Issue and consume short-lived, account-bound quotes in Redis. */
export function socialRefreshQuoteStore(accountId: string, scope: string) {
  const prefix = `recoup:mcp:social-refresh:{${accountId}}`;
  const lockKey = `${prefix}:execution`;

  async function withRedis<Result>(action: (redis: Redis) => Promise<Result>) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("Social refresh quote storage unavailable");
    const redis = new Redis(url, {
      lazyConnect: true,
      connectTimeout: 3000,
      commandTimeout: 5000,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    redis.on("error", () => console.error("[social refresh] quote storage failed"));
    try {
      await redis.connect();
      return await action(redis);
    } finally {
      redis.disconnect();
    }
  }

  return {
    issue: () =>
      withRedis(async redis => {
        const token = randomUUID();
        const expiresAt = Date.now() + QUOTE_TTL_SECONDS * 1000;
        const result = await redis.set(
          `${prefix}:quote:${token}`,
          scope,
          "EX",
          QUOTE_TTL_SECONDS,
          "NX",
        );
        if (result !== "OK") throw new Error("Could not save social refresh quote");
        return { token, expiresAt };
      }),
    claim: (token: string) =>
      withRedis(async redis => {
        const result = await redis.eval(
          claim,
          2,
          `${prefix}:quote:${token}`,
          lockKey,
          scope,
          token,
          EXECUTION_TTL_SECONDS,
        );
        if (result === 0) return "invalid";
        if (result === 1) return "busy";
        if (result === 2) return "claimed";
        throw new Error("Could not claim social refresh quote");
      }),
    release: (token: string) => withRedis(redis => redis.eval(release, 1, lockKey, token)),
  };
}
