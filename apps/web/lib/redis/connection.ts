import { Redis } from "ioredis";

// Verify environment is loaded
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL is not set");
}

// Parse Redis URL manually to ensure proper connection
const url = new URL(redisUrl as string);
const redisConfig = {
  host: url.hostname,
  port: parseInt(url.port, 10),
  password: url.password,
  lazyConnect: true,
  retryDelayOnFailover: 100,
};

// Create Redis connection
const redis = new Redis(redisConfig);

// Handle connection events
redis.on("error", error => {
  console.error("[Redis] Connection error:", error);
});

export default redis;
