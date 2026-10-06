import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { consumeOAuthRateLimit } from "../consumeOAuthRateLimit";
const { rpc, request, abortSignal } = vi.hoisted(() => ({
  rpc: vi.fn(),
  request: vi.fn(),
  abortSignal: vi.fn(),
}));
vi.mock("../../serverClient", () => ({ default: { rpc } }));
const namespace = "a".repeat(64);
const budgets = [{ key: "b".repeat(64), limit: 120 }];
beforeEach(() => {
  vi.resetAllMocks();
  rpc.mockReturnValue({ abortSignal });
  abortSignal.mockImplementation(() => request());
});
it("uses one atomic RPC and returns its retry delay", async () => {
  request.mockResolvedValue({ data: 17, error: null });
  expect(await consumeOAuthRateLimit(namespace, budgets)).toBe(17);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("consume_oauth_rate_limit", {
    p_namespace: namespace,
    p_keys: [budgets[0].key],
    p_limits: [120],
  });
});
it.each([null, "0", -1, 61, 0.5])("rejects malformed server results: %s", async data => {
  request.mockResolvedValue({ data, error: null });
  await expect(consumeOAuthRateLimit(namespace, budgets)).rejects.toThrow(
    /^OAuth throttling unavailable$/,
  );
});
it("fails closed and redacts database failures", async () => {
  request.mockResolvedValue({ data: 0, error: new Error("private database detail") });
  await expect(consumeOAuthRateLimit(namespace, budgets)).rejects.toThrow(
    /^OAuth throttling unavailable$/,
  );
  request.mockRejectedValue(new Error("private database detail"));
  await expect(consumeOAuthRateLimit(namespace, budgets)).rejects.toThrow(
    /^OAuth throttling unavailable$/,
  );
});

afterEach(() => vi.useRealTimers());
it("bounds stalled requests to two seconds and aborts the transport", async () => {
  vi.useFakeTimers();
  request.mockImplementation(() => new Promise(() => {}));
  const result = consumeOAuthRateLimit(namespace, budgets);
  const rejection = expect(result).rejects.toThrow(/^OAuth throttling unavailable$/);
  const signal = abortSignal.mock.calls[0][0] as AbortSignal;
  expect(signal.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(2000);
  await rejection;
  expect(signal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
