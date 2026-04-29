import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createSubscriptionSessionHandler } from "@/lib/stripe/createSubscriptionSessionHandler";
import { validateCreateSubscriptionSessionRequest } from "@/lib/stripe/validateCreateSubscriptionSessionRequest";
import { createStripeSession } from "@/lib/stripe/createStripeSession";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/stripe/validateCreateSubscriptionSessionRequest", () => ({
  validateCreateSubscriptionSessionRequest: vi.fn(),
}));

vi.mock("@/lib/stripe/createStripeSession", () => ({
  createStripeSession: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

describe("createSubscriptionSessionHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
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
    vi.mocked(validateCreateSubscriptionSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      successUrl: "https://chat.recoupable.com/ok",
    });
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
  });

  it("returns 400 { error } when session.url is null", async () => {
    vi.mocked(validateCreateSubscriptionSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      successUrl: "https://chat.recoupable.com/ok",
    });
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

  it("returns 400 { error } when createStripeSession throws", async () => {
    vi.mocked(validateCreateSubscriptionSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      successUrl: "https://chat.recoupable.com/ok",
    });
    vi.mocked(createStripeSession).mockRejectedValue(new Error("Stripe down"));

    const res = await createSubscriptionSessionHandler(
      new NextRequest("http://localhost/api/subscriptions/sessions", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Stripe down" });
  });
});
