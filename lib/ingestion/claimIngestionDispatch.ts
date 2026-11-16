import { Redis } from "ioredis";
/** Bound duplicate dispatches with an atomic, ten-minute lease, retaining it on uncertain starts. */
export async function claimIngestionDispatch(jobId: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(jobId)) throw new Error("Invalid ingestion job");
  const url = process.env.INGESTION_REDIS_URL ?? process.env.REDIS_URL;
  if (!url) throw new Error("Ingestion dispatch storage unavailable");
  const redis = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 3000,
    commandTimeout: 5000,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
  redis.on("error", () => {
    console.error("[ingestion] dispatch lease storage failed");
  });
  try {
    await redis.connect();
    return (
      (await redis.set(`recoup:ingestion:dispatch:${jobId}`, "claimed", "EX", 600, "NX")) === "OK"
    );
  } finally {
    redis.disconnect();
  }
}
