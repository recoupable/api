import "./routeTestMocks";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import type Stripe from "stripe";
import { verifyStripeWebhookEvent } from "@/lib/stripe/verifyStripeWebhookEvent";
import { processCreditsTopupSession } from "@/lib/stripe/processCreditsTopupSession";
import { processCreditsTopupPaymentIntent } from "@/lib/stripe/processCreditsTopupPaymentIntent";

const { POST } = await import("../route");

const URL = "http://localhost/api/webhooks/stripe";
const makeReq = () => new NextRequest(URL, { method: "POST", body: "{}" });
const sessionEvent = (data: object = {}): Stripe.Event =>
  ({ id: "evt_1", type: "checkout.session.completed", data: { object: data } }) as Stripe.Event;
const piEvent = (data: object = {}): Stripe.Event =>
  ({ id: "evt_2", type: "payment_intent.succeeded", data: { object: data } }) as Stripe.Event;

describe("POST /api/webhooks/stripe (handler outcomes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns 400 when signature verification fails", async () => {
    vi.mocked(verifyStripeWebhookEvent).mockResolvedValue({ error: "Invalid Stripe signature" });
    const res = await POST(makeReq());
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid Stripe signature" });
    expect(processCreditsTopupSession).not.toHaveBeenCalled();
  });

  it("delegates checkout.session.completed events and returns 200 received:true", async () => {
    const session = { id: "cs_test_1", mode: "payment" };
    vi.mocked(verifyStripeWebhookEvent).mockResolvedValue({ event: sessionEvent(session) });
    vi.mocked(processCreditsTopupSession).mockResolvedValue(undefined);

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true });
    expect(processCreditsTopupSession).toHaveBeenCalledWith(session);
  });

  it("delegates payment_intent.succeeded events to processCreditsTopupPaymentIntent", async () => {
    const pi = { id: "pi_ok", status: "succeeded" };
    vi.mocked(verifyStripeWebhookEvent).mockResolvedValue({ event: piEvent(pi) });
    vi.mocked(processCreditsTopupPaymentIntent).mockResolvedValue(undefined);

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true });
    expect(processCreditsTopupPaymentIntent).toHaveBeenCalledWith(pi);
    expect(processCreditsTopupSession).not.toHaveBeenCalled();
  });

  it("ignores unhandled event types", async () => {
    vi.mocked(verifyStripeWebhookEvent).mockResolvedValue({
      event: { id: "evt_2", type: "customer.created", data: { object: {} } } as Stripe.Event,
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true });
    expect(processCreditsTopupSession).not.toHaveBeenCalled();
  });

  it("returns 500 when the event handler throws (so Stripe retries)", async () => {
    vi.mocked(verifyStripeWebhookEvent).mockResolvedValue({ event: sessionEvent({ id: "cs_x" }) });
    vi.mocked(processCreditsTopupSession).mockRejectedValue(new Error("DB down"));

    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
