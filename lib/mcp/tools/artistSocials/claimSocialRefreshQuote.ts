import { Redis } from "ioredis";

/** Claim one signed refresh quote across all API instances before starting provider jobs. */
export async function claimSocialRefreshQuote(
  quoteId: string,
  expiresAt: number,
): Promise<boolean> {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("Social refresh quote storage unavailable");
  const redis = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 3000,
    commandTimeout: 5000,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
  redis.on("error", () => console.error("[social refresh] quote storage unavailable"));
  try {
    await redis.connect();
    if (Date.now() >= expiresAt) return false;
    // Retain the claim beyond the quote lifetime to cover clock skew across API instances.
    return (
      (await redis.set(`recoup:mcp:social-refresh:${quoteId}`, "claimed", "EX", 900, "NX")) === "OK"
    );
  } finally {
    redis.disconnect();
  }
}
