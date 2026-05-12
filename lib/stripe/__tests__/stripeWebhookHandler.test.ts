import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import type Stripe from "stripe";

const { verifyStripeWebhookEventMock, processCreditsTopupSessionMock } = vi.hoisted(() => ({
  verifyStripeWebhookEventMock: vi.fn(),
  processCreditsTopupSessionMock: vi.fn(),
}));

vi.mock("@/lib/stripe/verifyStripeWebhookEvent", () => ({
  verifyStripeWebhookEvent: verifyStripeWebhookEventMock,
}));

vi.mock("@/lib/stripe/processCreditsTopupSession", () => ({
  processCreditsTopupSession: processCreditsTopupSessionMock,
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const { stripeWebhookHandler } = await import("@/lib/stripe/stripeWebhookHandler");

const makeReq = () =>
  new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: "{}",
  });

const sessionEvent = (data: object = {}): Stripe.Event =>
  ({
    id: "evt_1",
    type: "checkout.session.completed",
    data: { object: data },
  }) as unknown as Stripe.Event;

describe("stripeWebhookHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.mocked(console.error).mockRestore();
  });

  it("returns 400 when signature verification fails", async () => {
    verifyStripeWebhookEventMock.mockResolvedValue({ error: "Invalid Stripe signature" });

    const res = await stripeWebhookHandler(makeReq());
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid Stripe signature" });
    expect(processCreditsTopupSessionMock).not.toHaveBeenCalled();
  });

  it("delegates checkout.session.completed events to processCreditsTopupSession", async () => {
    const session = { id: "cs_test_1", mode: "payment" };
    verifyStripeWebhookEventMock.mockResolvedValue({ event: sessionEvent(session) });
    processCreditsTopupSessionMock.mockResolvedValue(undefined);

    const res = await stripeWebhookHandler(makeReq());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true });
    expect(processCreditsTopupSessionMock).toHaveBeenCalledWith(session);
  });

  it("ignores unhandled event types and returns 200 received: true", async () => {
    verifyStripeWebhookEventMock.mockResolvedValue({
      event: { id: "evt_2", type: "customer.created", data: { object: {} } } as Stripe.Event,
    });

    const res = await stripeWebhookHandler(makeReq());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true });
    expect(processCreditsTopupSessionMock).not.toHaveBeenCalled();
  });

  it("returns 500 when the event handler throws (so Stripe retries)", async () => {
    verifyStripeWebhookEventMock.mockResolvedValue({ event: sessionEvent({ id: "cs_x" }) });
    processCreditsTopupSessionMock.mockRejectedValue(new Error("DB down"));

    const res = await stripeWebhookHandler(makeReq());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
