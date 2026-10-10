import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { deliverPluginPurchase } from "../deliverPluginPurchase";
const mocks = vi.hoisted(() => ({
  retrieve: vi.fn(),
  subscription: vi.fn(),
  update: vi.fn(),
  send: vi.fn(),
}));
vi.mock("@/lib/stripe/client", () => ({
  default: {
    checkout: { sessions: { retrieve: mocks.retrieve, update: mocks.update } },
    subscriptions: { retrieve: mocks.subscription },
  },
}));
vi.mock("@/lib/emails/sendEmail", () => ({ sendEmailWithResend: mocks.send }));
vi.mock("@/lib/const", () => ({ RECOUP_FROM_EMAIL: "Recoup <agent@example.com>" }));
const session = {
  id: "cs_plugin",
  mode: "subscription",
  payment_status: "paid",
  metadata: { fulfillment: "recoup-plugin" },
  subscription: "sub_1",
  customer_details: { email: "buyer@example.com" },
} as unknown as Stripe.Checkout.Session;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.retrieve.mockResolvedValue(session);
  mocks.subscription.mockResolvedValue({ status: "active", metadata: { accountId: "account_1" } });
  mocks.send.mockResolvedValue({ id: "email_1" });
  mocks.update.mockResolvedValue({});
});
describe("plugin purchase delivery", () => {
  it("sends to the paid session's email with a fixed download page and retry key", async () => {
    await deliverPluginPurchase(session);
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["buyer@example.com"],
        text: expect.stringContaining(
          "https://recoupable.dev/label-in-a-box/setup#purchase=cs_plugin",
        ),
      }),
      { idempotencyKey: "plugin-purchase/cs_plugin" },
    );
    expect(mocks.update).toHaveBeenCalledWith("cs_plugin", {
      metadata: { pluginEmailSent: "true" },
    });
  });
  it("does not email ordinary subscriptions", async () => {
    await deliverPluginPurchase({ ...session, metadata: {} });
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });
  it.each(["unpaid", "no_payment_required"])(
    "does not deliver %s checkouts",
    async payment_status => {
      mocks.retrieve.mockResolvedValue({ ...session, payment_status });
      await deliverPluginPurchase(session);
      expect(mocks.send).not.toHaveBeenCalled();
    },
  );
  it("skips completed deliveries on later webhook retries", async () => {
    mocks.retrieve.mockResolvedValue({
      ...session,
      metadata: { ...session.metadata, pluginEmailSent: "true" },
    });
    await deliverPluginPurchase(session);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("waits for an active linked subscription", async () => {
    mocks.subscription.mockResolvedValue({
      status: "past_due",
      metadata: { accountId: "account_1" },
    });
    await deliverPluginPurchase(session);
    expect(mocks.send).not.toHaveBeenCalled();
    mocks.subscription.mockResolvedValue({ status: "active", metadata: {} });
    await expect(deliverPluginPurchase(session)).rejects.toThrow("linking");
  });
  it("allows Stripe to retry email failures without marking delivery", async () => {
    mocks.send.mockResolvedValue(NextResponse.json({ error: "failed" }, { status: 502 }));
    await expect(deliverPluginPurchase(session)).rejects.toThrow("email failed");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("reuses the email idempotency key after a metadata-write failure", async () => {
    mocks.update.mockRejectedValueOnce(new Error("network"));
    await expect(deliverPluginPurchase(session)).rejects.toThrow("network");
    await deliverPluginPurchase(session);
    expect(mocks.send.mock.calls.map(c => c[1])).toEqual([
      { idempotencyKey: "plugin-purchase/cs_plugin" },
      { idempotencyKey: "plugin-purchase/cs_plugin" },
    ]);
  });
});
