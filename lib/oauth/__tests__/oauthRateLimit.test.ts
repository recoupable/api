import type { IncomingMessage } from "node:http";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { checkOAuthRateLimit } from "../checkOAuthRateLimit";
const { consume } = vi.hoisted(() => ({
  consume: vi
    .fn<(namespace: string, budgets: { key: string; limit: number }[]) => Promise<number>>()
    .mockResolvedValue(0),
}));
vi.mock("../../supabase/oauth_rate_limits/consumeOAuthRateLimit", () => ({
  consumeOAuthRateLimit: consume,
}));
beforeEach(() => {
  vi.stubEnv("OAUTH_ISSUER", "https://api.example/api/oauth");
  vi.stubEnv("OAUTH_INDEX_KEY", Buffer.alloc(32, 1).toString("base64"));
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());
it("uses shared and peer budgets, with stricter registration and no raw IP keys", async () => {
  await checkOAuthRateLimit({
    url: "/api/oauth/reg",
    socket: { remoteAddress: "127.0.0.1" },
  } as IncomingMessage);
  expect(consume.mock.calls[0][1].map((b: { limit: number }) => b.limit)).toEqual([
    1200, 120, 100, 10,
  ]);
  expect(JSON.stringify(consume.mock.calls)).not.toContain("127.0.0.1");
});
it("ignores caller-controlled forwarded IPs and fails closed without a peer", async () => {
  const request = {
    url: "/api/oauth/token",
    socket: { remoteAddress: "127.0.0.1" },
    headers: { "x-forwarded-for": "1.1.1.1" },
  };
  await checkOAuthRateLimit(request as unknown as IncomingMessage);
  request.headers["x-forwarded-for"] = "2.2.2.2";
  await checkOAuthRateLimit(request as unknown as IncomingMessage);
  expect(consume.mock.calls[0]).toEqual(consume.mock.calls[1]);
  await expect(checkOAuthRateLimit({ socket: {} } as IncomingMessage)).rejects.toThrow();
});
