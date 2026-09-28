import { afterEach, expect, it, vi } from "vitest";
import { requireFanEntitlement } from "../requireFanEntitlement";
const subscriptions = vi.hoisted(() => vi.fn());
vi.mock("@/lib/stripe/getActiveSubscriptions", () => ({ getActiveSubscriptions: subscriptions }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
it("keeps activation unavailable until billing policy is configured", async () => {
  vi.stubEnv("SITES_FAN_CONNECTION_BILLING", "");
  await expect(requireFanEntitlement("owner")).rejects.toMatchObject({ status: 503 });
  expect(subscriptions).not.toHaveBeenCalled();
});
it("accepts an active paid subscription for the owning workspace", async () => {
  vi.stubEnv("SITES_FAN_CONNECTION_BILLING", "paid-subscription");
  subscriptions.mockResolvedValue([
    { status: "active", items: { data: [{ price: { id: "paid", unit_amount: 100 } }] } },
  ]);
  await expect(requireFanEntitlement("owner")).resolves.toBeUndefined();
  expect(subscriptions).toHaveBeenCalledWith("owner");
});
it("rejects noneligible prices and inactive subscriptions", async () => {
  vi.stubEnv("SITES_FAN_CONNECTION_BILLING", "price-allowlist");
  vi.stubEnv("SITES_FAN_CONNECTION_PRICE_IDS", "addon");
  subscriptions.mockResolvedValue([
    { status: "active", items: { data: [{ price: { id: "other", unit_amount: 100 } }] } },
    { status: "past_due", items: { data: [{ price: { id: "addon", unit_amount: 100 } }] } },
  ]);
  await expect(requireFanEntitlement("owner")).rejects.toMatchObject({ status: 402 });
});
