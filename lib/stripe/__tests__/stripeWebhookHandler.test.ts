import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import type Stripe from "stripe";

const {
  verifyStripeWebhookEventMock,
  processCreditsTopupSessionMock,
  processCreditsTopupPaymentIntentMock,
} = vi.hoisted(() => ({
  verifyStripeWebhookEventMock: vi.fn(),
  processCreditsTopupSessionMock: vi.fn(),
  processCreditsTopupPaymentIntentMock: vi.fn(),
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
