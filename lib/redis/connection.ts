import { Redis } from "ioredis";

let cachedRedis: Redis | null = null;

function getRedis(): Redis {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is not set");
  }
  if (!cachedRedis) {
    const url = new URL(redisUrl);
    const redisConfig = {
      host: url.hostname,
      port: parseInt(url.port, 10),
      password: url.password,
      lazyConnect: true,
      retryDelayOnFailover: 100,
    };
    cachedRedis = new Redis(redisConfig);
    cachedRedis.on("error", error => {
      console.error("[Redis] Connection error:", error);
    });
  }
  return cachedRedis;
}

/** Lazy Redis so `next build` can load routes without REDIS_URL at import time. */
const redis = new Proxy({} as Redis, {
  get(_target, prop, receiver) {
    return Reflect.get(getRedis(), prop, receiver);
  },
});

export default redis;
