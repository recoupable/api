import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createSubscriptionSessionHandler } from "@/lib/stripe/createSubscriptionSessionHandler";
import { validateCreateSubscriptionSessionRequest } from "@/lib/stripe/validateCreateSubscriptionSessionRequest";
import { createStripeSession } from "@/lib/stripe/createStripeSession";
import { resolveCheckoutPrice } from "@/lib/stripe/checkout/resolveCheckoutPrice";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/stripe/validateCreateSubscriptionSessionRequest", () => ({
  validateCreateSubscriptionSessionRequest: vi.fn(),
}));

vi.mock("@/lib/stripe/createStripeSession", () => ({
  createStripeSession: vi.fn(),
}));

vi.mock("@/lib/stripe/checkout/resolveCheckoutPrice", () => ({
  resolveCheckoutPrice: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const validated = {
  accountId: ACCOUNT,
  plan: "pro" as const,
  successUrl: "https://chat.recoupable.com/ok",
  cancelUrl: undefined,
};

describe("createSubscriptionSessionHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(resolveCheckoutPrice).mockReturnValue({
      price: "price_pro",
      trialPeriodDays: 30,
    });
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns validation response unchanged", async () => {
    const err = NextResponse.json({ error: "bad" }, { status: 400 });
    vi.mocked(validateCreateSubscriptionSessionRequest).mockResolvedValue(err);
    const req = new NextRequest("http://localhost/api/subscriptions/sessions", {
      method: "POST",
      body: "{}",
    });
    expect(await createSubscriptionSessionHandler(req)).toBe(err);
    expect(createStripeSession).not.toHaveBeenCalled();
  });

  it("returns 200 with id and url", async () => {
    vi.mocked(validateCreateSubscriptionSessionRequest).mockResolvedValue(validated);
    vi.mocked(createStripeSession).mockResolvedValue({
      id: "cs_test_abc",
      url: "https://checkout.stripe.com/pay/cs_test_abc",
    } as Awaited<ReturnType<typeof createStripeSession>>);

    const res = await createSubscriptionSessionHandler(
      new NextRequest("http://localhost/api/subscriptions/sessions", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: "cs_test_abc",
      url: "https://checkout.stripe.com/pay/cs_test_abc",
    });
    expect(createStripeSession).toHaveBeenCalledWith({
      ...validated,
      price: { price: "price_pro", trialPeriodDays: 30 },
    });
  });

  it("returns 400 starter_unavailable when the Starter price is not configured", async () => {
    vi.mocked(validateCreateSubscriptionSessionRequest).mockResolvedValue({
      ...validated,
      plan: "starter",
      accountId: null,
    });
    vi.mocked(resolveCheckoutPrice).mockReturnValue(null);

    const res = await createSubscriptionSessionHandler(
      new NextRequest("http://localhost/api/subscriptions/sessions", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "starter_unavailable" });
  });

  it("returns 400 { error } when session.url is null", async () => {
    vi.mocked(validateCreateSubscriptionSessionRequest).mockResolvedValue(validated);
    vi.mocked(createStripeSession).mockResolvedValue({
      id: "cs_test_abc",
      url: null,
    } as Awaited<ReturnType<typeof createStripeSession>>);

    const res = await createSubscriptionSessionHandler(
      new NextRequest("http://localhost/api/subscriptions/sessions", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Checkout session URL missing" });
  });

  it("returns 500 with generic { error } when createStripeSession throws", async () => {
    vi.mocked(validateCreateSubscriptionSessionRequest).mockResolvedValue(validated);
    vi.mocked(createStripeSession).mockRejectedValue(new Error("Stripe down"));

    const res = await createSubscriptionSessionHandler(
      new NextRequest("http://localhost/api/subscriptions/sessions", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
