import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Redis } from "ioredis";
import { expect, it, vi } from "vitest";
import { consumeOAuthRateLimit } from "../../../lib/redis/consumeOAuthRateLimit";

it.skipIf(!process.env.OAUTH_TEST_REDIS_SERVER)(
  "enforces atomic budgets across concurrent requests and restores capacity after expiry",
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "recoup-oauth-redis-"));
    const socket = join(directory, "redis.sock");
    const server = spawn(
      process.env.OAUTH_TEST_REDIS_SERVER!,
      [
        "--port",
        "0",
        "--unixsocket",
        socket,
        "--unixsocketperm",
        "700",
        "--save",
        "",
        "--appendonly",
        "no",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let client: Redis | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Redis fixture startup timeout")), 5000);
        server.once("error", error => {
          clearTimeout(timeout);
          reject(error);
        });
        server.once("exit", () => {
          clearTimeout(timeout);
          reject(new Error("Redis fixture exited early"));
        });
        server.stdout.on("data", chunk => {
          if (/ready to accept connections/i.test(String(chunk))) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
      vi.stubEnv("REDIS_URL", socket);
      client = new Redis(socket);
      const budgets = [
        { key: "fixture:global", limit: 10 },
        { key: "fixture:peer", limit: 5 },
      ];
      const results = await Promise.all(
        Array.from({ length: 20 }, () => consumeOAuthRateLimit(budgets)),
      );
      expect(results.filter(retry => retry === 0)).toHaveLength(5);
      expect(results.filter(retry => retry > 0)).toHaveLength(15);
      expect(await client.get("fixture:global")).toBe("5");
      expect(await client.pttl("fixture:peer")).toBeGreaterThan(0);
      await client.pexpire("fixture:peer", 30);
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(await consumeOAuthRateLimit(budgets)).toBe(0);
      // A damaged counter without TTL remains blocked instead of silently bypassing limits.
      await client.set("fixture:peer", "5");
      expect(await consumeOAuthRateLimit(budgets)).toBe(60);
    } finally {
      vi.unstubAllEnvs();
      client?.disconnect();
      if (server.pid && server.exitCode === null && server.signalCode === null) {
        const stopped = once(server, "exit");
        server.kill("SIGTERM");
        await stopped;
      }
      await rm(directory, { recursive: true, force: true });
    }
  },
);
