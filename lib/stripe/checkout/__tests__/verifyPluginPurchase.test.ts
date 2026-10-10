import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyPluginPurchase } from "../verifyPluginPurchase";
const mocks = vi.hoisted(() => ({ retrieve: vi.fn(), subscription: vi.fn() }));
vi.mock("@/lib/stripe/client", () => ({
  default: {
    checkout: { sessions: { retrieve: mocks.retrieve } },
    subscriptions: { retrieve: mocks.subscription },
  },
}));
const sessionId = "cs_test_123456789012345678901234";
const paid = {
  mode: "subscription",
  status: "complete",
  payment_status: "paid",
  metadata: { fulfillment: "recoup-plugin" },
  subscription: "sub_1",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.retrieve.mockResolvedValue(paid);
  mocks.subscription.mockResolvedValue({ status: "active", metadata: { plan: "starter" } });
});
describe("private purchase link", () => {
  it("allows a paid, tagged, active subscription without account authentication", async () => {
    expect(await verifyPluginPurchase({ sessionId })).toBe(true);
  });
  it("rejects invalid or caller-expanded input before Stripe", async () => {
    expect(await verifyPluginPurchase({ sessionId: "fake" })).toBe(false);
    expect(await verifyPluginPurchase({ sessionId, allowed: true })).toBe(false);
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });
  it.each([
    { payment_status: "unpaid" },
    { status: "open" },
    { mode: "payment" },
    { metadata: {} },
    { subscription: null },
  ])("rejects ineligible checkouts %j", async change => {
    mocks.retrieve.mockResolvedValue({ ...paid, ...change });
    expect(await verifyPluginPurchase({ sessionId })).toBe(false);
  });
  it.each(["canceled", "past_due", "trialing", "unpaid"])(
    "rejects %s subscription",
    async status => {
      mocks.subscription.mockResolvedValue({ status, metadata: { plan: "starter" } });
      expect(await verifyPluginPurchase({ sessionId })).toBe(false);
    },
  );
  it("fails closed if Stripe is unavailable", async () => {
    mocks.retrieve.mockRejectedValue(new Error("network"));
    await expect(verifyPluginPurchase({ sessionId })).rejects.toThrow();
  });
});
