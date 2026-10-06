import { beforeEach, expect, it, vi } from "vitest";
import { consumeOAuthRateLimit } from "../consumeOAuthRateLimit";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../serverClient", () => ({ default: { rpc } }));
const namespace = "a".repeat(64);
const budgets = [{ key: "b".repeat(64), limit: 120 }];
beforeEach(() => {
  vi.resetAllMocks();
});
it("uses one atomic RPC and returns its retry delay", async () => {
  rpc.mockResolvedValue({ data: 17, error: null });
  expect(await consumeOAuthRateLimit(namespace, budgets)).toBe(17);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("consume_oauth_rate_limit", {
    p_namespace: namespace,
    p_keys: [budgets[0].key],
    p_limits: [120],
  });
});
it.each([null, "0", -1, 61, 0.5])("rejects malformed server results: %s", async data => {
  rpc.mockResolvedValue({ data, error: null });
  await expect(consumeOAuthRateLimit(namespace, budgets)).rejects.toThrow(
    "OAuth throttling unavailable",
  );
});
it("fails closed and redacts database failures", async () => {
  rpc.mockResolvedValue({ data: 0, error: new Error("private database detail") });
  await expect(consumeOAuthRateLimit(namespace, budgets)).rejects.toThrow(
    "OAuth throttling unavailable",
  );
  rpc.mockRejectedValue(new Error("private database detail"));
  await expect(consumeOAuthRateLimit(namespace, budgets)).rejects.toThrow(
    "OAuth throttling unavailable",
  );
});
