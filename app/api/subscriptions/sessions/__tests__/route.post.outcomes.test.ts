import "./routeTestMocks";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateSubscriptionSessionRequest } from "@/lib/stripe/validateCreateSubscriptionSessionRequest";
import { createStripeSession } from "@/lib/stripe/createStripeSession";

const { POST } = await import("../route");

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174001";

describe("POST /api/subscriptions/sessions (handler outcomes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateCreateSubscriptionSessionRequest).mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.mocked(console.error).mockRestore();
  });

  it("returns validation response unchanged", async () => {
    const err = NextResponse.json({ error: "bad" }, { status: 400 });
    vi.mocked(validateCreateSubscriptionSessionRequest).mockResolvedValue(err);
    const req = new NextRequest("http://localhost/api/subscriptions/sessions", {
      method: "POST",
      body: "{}",
    });
    expect(await POST(req)).toBe(err);
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

    const res = await POST(
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

  it("returns 400 when session.url is null", async () => {
    vi.mocked(validateCreateSubscriptionSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      successUrl: "https://chat.recoupable.com/ok",
    });
    vi.mocked(createStripeSession).mockResolvedValue({
      id: "cs_test_abc",
      url: null,
    } as Awaited<ReturnType<typeof createStripeSession>>);

    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/sessions", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Checkout session URL missing" });
  });

  it("returns 500 when createStripeSession throws", async () => {
    vi.mocked(validateCreateSubscriptionSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      successUrl: "https://chat.recoupable.com/ok",
    });
    vi.mocked(createStripeSession).mockRejectedValue(new Error("Stripe down"));

    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/sessions", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
