import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import type Stripe from "stripe";

const {
  verifyStripeWebhookEventMock,
  processCreditsTopupSessionMock,
  processCreditsTopupPaymentIntentMock,
  processSubscriptionCreatedMock,
  processSubscriptionTrialWillEndMock,
  processSubscriptionUpdatedMock,
  processSubscriptionDeletedMock,
  processInvoicePaidMock,
  notifyCreditsTopupPaymentIntentMock,
  notifyCreditsTopupSessionMock,
} = vi.hoisted(() => ({
  verifyStripeWebhookEventMock: vi.fn(),
  processCreditsTopupSessionMock: vi.fn(),
  processCreditsTopupPaymentIntentMock: vi.fn(),
  processSubscriptionCreatedMock: vi.fn(),
  processSubscriptionTrialWillEndMock: vi.fn(),
  processSubscriptionUpdatedMock: vi.fn(),
  processSubscriptionDeletedMock: vi.fn(),
  processInvoicePaidMock: vi.fn(),
  notifyCreditsTopupPaymentIntentMock: vi.fn(),
  notifyCreditsTopupSessionMock: vi.fn(),
}));

vi.mock("@/lib/stripe/verifyStripeWebhookEvent", () => ({
  verifyStripeWebhookEvent: verifyStripeWebhookEventMock,
}));
vi.mock("@/lib/stripe/processCreditsTopupSession", () => ({
  processCreditsTopupSession: processCreditsTopupSessionMock,
}));
vi.mock("@/lib/stripe/processCreditsTopupPaymentIntent", () => ({
  processCreditsTopupPaymentIntent: processCreditsTopupPaymentIntentMock,
}));
vi.mock("@/lib/stripe/processSubscriptionCreated", () => ({
  processSubscriptionCreated: processSubscriptionCreatedMock,
}));
vi.mock("@/lib/stripe/processSubscriptionTrialWillEnd", () => ({
  processSubscriptionTrialWillEnd: processSubscriptionTrialWillEndMock,
}));
vi.mock("@/lib/stripe/processSubscriptionUpdated", () => ({
  processSubscriptionUpdated: processSubscriptionUpdatedMock,
}));
vi.mock("@/lib/stripe/processSubscriptionDeleted", () => ({
  processSubscriptionDeleted: processSubscriptionDeletedMock,
}));
vi.mock("@/lib/stripe/processInvoicePaid", () => ({
  processInvoicePaid: processInvoicePaidMock,
}));
vi.mock("@/lib/stripe/notifyCreditsTopupPaymentIntent", () => ({
  notifyCreditsTopupPaymentIntent: notifyCreditsTopupPaymentIntentMock,
}));
vi.mock("@/lib/stripe/notifyCreditsTopupSession", () => ({
  notifyCreditsTopupSession: notifyCreditsTopupSessionMock,
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const { stripeWebhookHandler } = await import("@/lib/stripe/stripeWebhookHandler");

const makeReq = () =>
  new NextRequest("http://localhost/api/webhooks/stripe", { method: "POST", body: "{}" });

const event = (type: string, data: object = {}): Stripe.Event =>
  ({ id: "evt_1", type, data: { object: data } }) as unknown as Stripe.Event;

describe("stripeWebhookHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns 400 when signature verification fails", async () => {
    verifyStripeWebhookEventMock.mockResolvedValue({ error: "Invalid Stripe signature" });
    const res = await stripeWebhookHandler(makeReq());
    expect(res.status).toBe(400);
    expect(processCreditsTopupSessionMock).not.toHaveBeenCalled();
    expect(processCreditsTopupPaymentIntentMock).not.toHaveBeenCalled();
  });

  it("delegates checkout.session.completed to processCreditsTopupSession", async () => {
    const session = { id: "cs_test_1", mode: "payment" };
    verifyStripeWebhookEventMock.mockResolvedValue({
      event: event("checkout.session.completed", session),
    });
    const res = await stripeWebhookHandler(makeReq());
    expect(res.status).toBe(200);
    expect(processCreditsTopupSessionMock).toHaveBeenCalledWith(session);
    expect(processCreditsTopupPaymentIntentMock).not.toHaveBeenCalled();
  });

  it("delegates payment_intent.succeeded to processCreditsTopupPaymentIntent", async () => {
    const pi = { id: "pi_ok", status: "succeeded" };
    verifyStripeWebhookEventMock.mockResolvedValue({
      event: event("payment_intent.succeeded", pi),
    });
    const res = await stripeWebhookHandler(makeReq());
    expect(res.status).toBe(200);
    expect(processCreditsTopupPaymentIntentMock).toHaveBeenCalledWith(pi);
    expect(processCreditsTopupSessionMock).not.toHaveBeenCalled();
  });

  it("ignores unhandled event types and returns 200 received: true", async () => {
    verifyStripeWebhookEventMock.mockResolvedValue({ event: event("customer.created") });
    const res = await stripeWebhookHandler(makeReq());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true });
    expect(processCreditsTopupSessionMock).not.toHaveBeenCalled();
    expect(processCreditsTopupPaymentIntentMock).not.toHaveBeenCalled();
  });

  it("delegates customer.subscription.created to processSubscriptionCreated", async () => {
    const sub = { id: "sub_1", status: "trialing" };
    verifyStripeWebhookEventMock.mockResolvedValue({
      event: event("customer.subscription.created", sub),
    });
    const res = await stripeWebhookHandler(makeReq());
    expect(res.status).toBe(200);
    expect(processSubscriptionCreatedMock).toHaveBeenCalledWith(sub);
  });

  it("delegates customer.subscription.trial_will_end to processSubscriptionTrialWillEnd", async () => {
    const sub = { id: "sub_1", trial_end: 1783415103 };
    verifyStripeWebhookEventMock.mockResolvedValue({
      event: event("customer.subscription.trial_will_end", sub),
    });
    const res = await stripeWebhookHandler(makeReq());
    expect(res.status).toBe(200);
    expect(processSubscriptionTrialWillEndMock).toHaveBeenCalledWith(sub);
  });

  it("delegates customer.subscription.updated with previous_attributes", async () => {
    const sub = { id: "sub_1", cancel_at_period_end: true };
    const previous = { cancel_at_period_end: false };
    verifyStripeWebhookEventMock.mockResolvedValue({
      event: {
        id: "evt_1",
        type: "customer.subscription.updated",
        data: { object: sub, previous_attributes: previous },
      } as unknown as Stripe.Event,
    });
    const res = await stripeWebhookHandler(makeReq());
    expect(res.status).toBe(200);
    expect(processSubscriptionUpdatedMock).toHaveBeenCalledWith(sub, previous);
  });

  it("delegates customer.subscription.deleted to processSubscriptionDeleted", async () => {
    const sub = { id: "sub_1", status: "canceled" };
    verifyStripeWebhookEventMock.mockResolvedValue({
      event: event("customer.subscription.deleted", sub),
    });
    const res = await stripeWebhookHandler(makeReq());
    expect(res.status).toBe(200);
    expect(processSubscriptionDeletedMock).toHaveBeenCalledWith(sub);
  });

  it("delegates invoice.paid to processInvoicePaid", async () => {
    const invoice = { id: "in_1", amount_paid: 9900 };
    verifyStripeWebhookEventMock.mockResolvedValue({ event: event("invoice.paid", invoice) });
    const res = await stripeWebhookHandler(makeReq());
    expect(res.status).toBe(200);
    expect(processInvoicePaidMock).toHaveBeenCalledWith(invoice);
  });

  it("notifies alongside the credits grant on payment_intent.succeeded", async () => {
    const pi = { id: "pi_1", metadata: { purpose: "credits_auto_recharge" } };
    verifyStripeWebhookEventMock.mockResolvedValue({
      event: event("payment_intent.succeeded", pi),
    });
    await stripeWebhookHandler(makeReq());
    expect(processCreditsTopupPaymentIntentMock).toHaveBeenCalledWith(pi);
    expect(notifyCreditsTopupPaymentIntentMock).toHaveBeenCalledWith(pi);
  });

  it("notifies alongside the credits grant on checkout.session.completed", async () => {
    const session = { id: "cs_1", mode: "payment" };
    verifyStripeWebhookEventMock.mockResolvedValue({
      event: event("checkout.session.completed", session),
    });
    await stripeWebhookHandler(makeReq());
    expect(processCreditsTopupSessionMock).toHaveBeenCalledWith(session);
    expect(notifyCreditsTopupSessionMock).toHaveBeenCalledWith(session);
  });

  it("returns 500 when the event handler throws (so Stripe retries)", async () => {
    verifyStripeWebhookEventMock.mockResolvedValue({
      event: event("checkout.session.completed", { id: "cs_x" }),
    });
    processCreditsTopupSessionMock.mockRejectedValue(new Error("DB down"));
    const res = await stripeWebhookHandler(makeReq());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
