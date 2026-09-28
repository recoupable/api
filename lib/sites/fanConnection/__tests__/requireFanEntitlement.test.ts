import { afterEach, expect, it, vi } from "vitest";
import { requireFanEntitlement } from "../requireFanEntitlement";
const subscriptions = vi.hoisted(() => vi.fn());
vi.mock("@/lib/stripe/getActiveSubscriptions", () => ({ getActiveSubscriptions: subscriptions }));
afterEach(() => vi.resetAllMocks());
it("includes fan connection in an active paid subscription without an add-on", async () => {
  subscriptions.mockResolvedValue([
    { status: "active", items: { data: [{ price: { unit_amount: 100 } }] } },
  ]);
  await expect(requireFanEntitlement("owner")).resolves.toBeUndefined();
  expect(subscriptions).toHaveBeenCalledWith("owner", expect.any(Function));
});
it("rejects free and past-due subscriptions", async () => {
  subscriptions.mockResolvedValue([
    { status: "active", items: { data: [{ price: { unit_amount: 0 } }] } },
    { status: "past_due", items: { data: [{ price: { unit_amount: 100 } }] } },
  ]);
  await expect(requireFanEntitlement("unpaid-owner")).rejects.toMatchObject({ status: 402 });
});
