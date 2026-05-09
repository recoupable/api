import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSessionHandler } from "@/lib/stripe/checkout/createCheckoutSessionHandler";
import { validateCreateCheckoutSessionRequest } from "@/lib/stripe/checkout/validateCreateCheckoutSessionRequest";
import { createCheckoutSession } from "@/lib/stripe/checkout/createCheckoutSession";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/stripe/checkout/validateCreateCheckoutSessionRequest", () => ({
  validateCreateCheckoutSessionRequest: vi.fn(),
}));

vi.mock("@/lib/stripe/checkout/createCheckoutSession", () => ({
  createCheckoutSession: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

describe("createCheckoutSessionHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns validation response unchanged", async () => {
    const err = NextResponse.json({ error: "bad" }, { status: 400 });
    vi.mocked(validateCreateCheckoutSessionRequest).mockResolvedValue(err);
    const req = new NextRequest("http://localhost/api/stripe/checkout-sessions", {
      method: "POST",
      body: "{}",
    });
    expect(await createCheckoutSessionHandler(req)).toBe(err);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("returns 200 with id and url", async () => {
    vi.mocked(validateCreateCheckoutSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      successUrl: "https://chat.recoupable.com/ok",
    });
    vi.mocked(createCheckoutSession).mockResolvedValue({
      id: "cs_test_abc",
      url: "https://checkout.stripe.com/pay/cs_test_abc",
    } as Awaited<ReturnType<typeof createCheckoutSession>>);

    const res = await createCheckoutSessionHandler(
      new NextRequest("http://localhost/api/stripe/checkout-sessions", {
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
    vi.mocked(validateCreateCheckoutSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      successUrl: "https://chat.recoupable.com/ok",
    });
    vi.mocked(createCheckoutSession).mockResolvedValue({
      id: "cs_test_abc",
      url: null,
    } as Awaited<ReturnType<typeof createCheckoutSession>>);

    const res = await createCheckoutSessionHandler(
      new NextRequest("http://localhost/api/stripe/checkout-sessions", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Checkout session URL missing" });
  });

  it("returns 500 with generic { error } when createCheckoutSession throws", async () => {
    vi.mocked(validateCreateCheckoutSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      successUrl: "https://chat.recoupable.com/ok",
    });
    vi.mocked(createCheckoutSession).mockRejectedValue(new Error("Stripe down"));

    const res = await createCheckoutSessionHandler(
      new NextRequest("http://localhost/api/stripe/checkout-sessions", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
