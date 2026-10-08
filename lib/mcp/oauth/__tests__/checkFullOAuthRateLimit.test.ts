import { afterEach, expect, it, vi } from "vitest";
import { checkFullOAuthRateLimit } from "../checkFullOAuthRateLimit";
const consume = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/oauth_rate_limits/consumeOAuthRateLimit", () => ({
  consumeOAuthRateLimit: consume,
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("shares account budgets across clients without storing raw account IDs", async () => {
  vi.stubEnv("OAUTH_INDEX_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("OAUTH_ISSUER", "https://api.example/api/oauth");
  consume.mockResolvedValue(0);
  await checkFullOAuthRateLimit("search_web", "owner");
  const [namespace, budgets] = consume.mock.calls[0];
  expect(namespace).toMatch(/^[a-f0-9]{64}$/);
  expect(budgets.map((b: { limit: number }) => b.limit)).toEqual([120, 30]);
  expect(JSON.stringify(budgets)).not.toContain("owner");
  await checkFullOAuthRateLimit("generate_image", "owner");
  expect(consume.mock.calls[1][1][0]).toEqual(budgets[0]);
  expect(consume.mock.calls[1][1][1].key).not.toEqual(budgets[1].key);
});
it("denies exhausted budgets and unavailable storage", async () => {
  vi.stubEnv("OAUTH_INDEX_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("OAUTH_ISSUER", "https://api.example/api/oauth");
  consume.mockResolvedValue(12);
  await expect(checkFullOAuthRateLimit("search_web", "owner")).rejects.toThrow(
    "retry in 12 seconds",
  );
  consume.mockRejectedValue(new Error("unavailable"));
  await expect(checkFullOAuthRateLimit("search_web", "owner")).rejects.toThrow();
});
