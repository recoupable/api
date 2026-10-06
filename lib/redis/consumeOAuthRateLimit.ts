import { Redis } from "ioredis";

let client: Redis | undefined;
const script = `
local retry = 0
for i, key in ipairs(KEYS) do
  if tonumber(redis.call('GET', key) or '0') >= tonumber(ARGV[i]) then
    local ttl = redis.call('PTTL', key)
    retry = math.max(retry, ttl > 0 and ttl or 60000)
  end
end
if retry > 0 then return retry end
for _, key in ipairs(KEYS) do
  if redis.call('INCR', key) == 1 then redis.call('PEXPIRE', key, 60000) end
end
return 0
`;

/** Atomically enforce shared one-minute budgets; Redis outages must fail closed. */
export async function consumeOAuthRateLimit(budgets: { key: string; limit: number }[]) {
  if (!client || client.status === "end") {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("OAuth throttling unavailable");
    client = new Redis(url, {
      lazyConnect: true,
      connectTimeout: 2000,
      commandTimeout: 2000,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    // The boundary emits a redacted availability event; never log a Redis URL/error payload.
    client.on("error", () => {});
  }
  const retryMs = await client.eval(
    script,
    budgets.length,
    ...budgets.map(b => b.key),
    ...budgets.map(b => b.limit),
  );
  if (typeof retryMs !== "number" || !Number.isSafeInteger(retryMs) || retryMs < 0)
    throw new Error("OAuth throttling unavailable");
  return Math.ceil(retryMs / 1000);
}
