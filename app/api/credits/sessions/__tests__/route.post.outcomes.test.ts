import "./routeTestMocks";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateCreditsSessionRequest } from "@/lib/stripe/validateCreateCreditsSessionRequest";
import { resolveStripeCustomerForAccount } from "@/lib/stripe/resolveStripeCustomerForAccount";
import { chargeCustomerOffSession } from "@/lib/stripe/chargeCustomerOffSession";
import { createCreditsStripeSession } from "@/lib/stripe/createCreditsStripeSession";

const { POST } = await import("../route");

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const URL = "http://localhost/api/credits/sessions";
const makeReq = () => new NextRequest(URL, { method: "POST", body: "{}" });
const validated = {
  accountId: ACCOUNT,
  successUrl: "https://chat.recoupable.com/ok",
  credits: 250,
};

describe("POST /api/credits/sessions (handler outcomes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(validateCreateCreditsSessionRequest).mockResolvedValue(validated);
    vi.mocked(resolveStripeCustomerForAccount).mockResolvedValue("cus_x");
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns validation response unchanged", async () => {
    const err = NextResponse.json({ error: "bad" }, { status: 400 });
    vi.mocked(validateCreateCreditsSessionRequest).mockResolvedValue(err);
    expect(await POST(makeReq())).toBe(err);
    expect(chargeCustomerOffSession).not.toHaveBeenCalled();
    expect(createCreditsStripeSession).not.toHaveBeenCalled();
  });

  it("returns 200 with paymentIntentId/creditsPurchased/totalCents on auto-charge success", async () => {
    vi.mocked(chargeCustomerOffSession).mockResolvedValue({
      kind: "charged",
      paymentIntentId: "pi_ok",
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      paymentIntentId: "pi_ok",
      creditsPurchased: 250,
      totalCents: 289,
    });
  });

  it("returns 200 with id/url when falling back to Checkout (no PM)", async () => {
    vi.mocked(chargeCustomerOffSession).mockResolvedValue({ kind: "no_payment_method" });
    vi.mocked(createCreditsStripeSession).mockResolvedValue({
      id: "cs_test_xyz",
      url: "https://checkout.stripe.com/pay/cs_test_xyz",
    } as Awaited<ReturnType<typeof createCreditsStripeSession>>);
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: "cs_test_xyz",
      url: "https://checkout.stripe.com/pay/cs_test_xyz",
    });
  });

  it("returns 400 when Checkout fallback returns null url", async () => {
    vi.mocked(chargeCustomerOffSession).mockResolvedValue({ kind: "no_payment_method" });
    vi.mocked(createCreditsStripeSession).mockResolvedValue({
      id: "cs_test_xyz",
      url: null,
    } as Awaited<ReturnType<typeof createCreditsStripeSession>>);
    const res = await POST(makeReq());
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Checkout session URL missing" });
  });

  it("returns 500 when chargeCustomerOffSession throws", async () => {
    vi.mocked(chargeCustomerOffSession).mockRejectedValue(new Error("Stripe down"));
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
