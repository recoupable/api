import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createCreditsSessionHandler } from "@/lib/stripe/createCreditsSessionHandler";
import { validateCreateCreditsSessionRequest } from "@/lib/stripe/validateCreateCreditsSessionRequest";
import { resolveStripeCustomerForAccount } from "@/lib/stripe/resolveStripeCustomerForAccount";
import { chargeCustomerOffSession } from "@/lib/stripe/chargeCustomerOffSession";
import { createCreditsStripeSession } from "@/lib/stripe/createCreditsStripeSession";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/stripe/validateCreateCreditsSessionRequest", () => ({
  validateCreateCreditsSessionRequest: vi.fn(),
}));
vi.mock("@/lib/stripe/resolveStripeCustomerForAccount", () => ({
  resolveStripeCustomerForAccount: vi.fn(),
}));
vi.mock("@/lib/stripe/chargeCustomerOffSession", () => ({
  chargeCustomerOffSession: vi.fn(),
}));
vi.mock("@/lib/stripe/createCreditsStripeSession", () => ({
  createCreditsStripeSession: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const validated = {
  accountId: ACCOUNT,
  successUrl: "https://chat.recoupable.com/ok",
  credits: 250,
};
const makeReq = () =>
  new NextRequest("http://localhost/api/credits/sessions", { method: "POST", body: "{}" });

describe("createCreditsSessionHandler", () => {
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
    expect(await createCreditsSessionHandler(makeReq())).toBe(err);
    expect(chargeCustomerOffSession).not.toHaveBeenCalled();
    expect(createCreditsStripeSession).not.toHaveBeenCalled();
  });

  it("auto-charges when the Customer has a saved card and returns paymentIntentId/creditsPurchased/totalCents", async () => {
    vi.mocked(chargeCustomerOffSession).mockResolvedValue({
      kind: "charged",
      paymentIntentId: "pi_ok",
    });
    const res = await createCreditsSessionHandler(makeReq());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      paymentIntentId: "pi_ok",
      creditsPurchased: 250,
      totalCents: 289,
    });
    expect(createCreditsStripeSession).not.toHaveBeenCalled();
  });

  it("falls back to Checkout when the Customer has no payment method on file", async () => {
    vi.mocked(chargeCustomerOffSession).mockResolvedValue({ kind: "no_payment_method" });
    vi.mocked(createCreditsStripeSession).mockResolvedValue({
      id: "cs_test_xyz",
      url: "https://checkout.stripe.com/pay/cs_test_xyz",
    } as Awaited<ReturnType<typeof createCreditsStripeSession>>);
    const res = await createCreditsSessionHandler(makeReq());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: "cs_test_xyz",
      url: "https://checkout.stripe.com/pay/cs_test_xyz",
    });
    expect(createCreditsStripeSession).toHaveBeenCalledWith({
      accountId: ACCOUNT,
      credits: 250,
      successUrl: "https://chat.recoupable.com/ok",
      customer: "cus_x",
    });
  });

  it("falls back to Checkout when off-session charge requires 3-D Secure authentication", async () => {
    vi.mocked(chargeCustomerOffSession).mockResolvedValue({ kind: "requires_action" });
    vi.mocked(createCreditsStripeSession).mockResolvedValue({
      id: "cs_3ds",
      url: "https://checkout.stripe.com/pay/cs_3ds",
    } as Awaited<ReturnType<typeof createCreditsStripeSession>>);
    const res = await createCreditsSessionHandler(makeReq());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: "cs_3ds",
      url: "https://checkout.stripe.com/pay/cs_3ds",
    });
  });

  it("returns 400 when Checkout fallback returns no url", async () => {
    vi.mocked(chargeCustomerOffSession).mockResolvedValue({ kind: "no_payment_method" });
    vi.mocked(createCreditsStripeSession).mockResolvedValue({
      id: "cs_test_xyz",
      url: null,
    } as Awaited<ReturnType<typeof createCreditsStripeSession>>);
    const res = await createCreditsSessionHandler(makeReq());
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Checkout session URL missing" });
  });

  it("returns 500 when chargeCustomerOffSession throws", async () => {
    vi.mocked(chargeCustomerOffSession).mockRejectedValue(new Error("Stripe down"));
    const res = await createCreditsSessionHandler(makeReq());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });

  it("returns 500 when resolveStripeCustomerForAccount throws", async () => {
    vi.mocked(resolveStripeCustomerForAccount).mockRejectedValue(new Error("Stripe down"));
    const res = await createCreditsSessionHandler(makeReq());
    expect(res.status).toBe(500);
  });
});
