import { validated } from "./createCreditsSessionHandlerTestMocks";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { createCreditsSessionHandler } from "@/lib/stripe/createCreditsSessionHandler";
import { validateCreateCreditsSessionRequest } from "@/lib/stripe/validateCreateCreditsSessionRequest";
import { resolveStripeCustomerForAccount } from "@/lib/stripe/resolveStripeCustomerForAccount";
import { chargeCustomerOffSession } from "@/lib/stripe/chargeCustomerOffSession";
import { createCreditsStripeSession } from "@/lib/stripe/createCreditsStripeSession";

const makeReq = () =>
  new NextRequest("http://localhost/api/credits/sessions", { method: "POST", body: "{}" });

describe("createCreditsSessionHandler — Checkout fallback paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(validateCreateCreditsSessionRequest).mockResolvedValue(validated);
    vi.mocked(resolveStripeCustomerForAccount).mockResolvedValue("cus_x");
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

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
      accountId: validated.accountId,
      credits: validated.credits,
      successUrl: validated.successUrl,
      customer: "cus_x",
    });
  });

  it("falls back to Checkout when off-session charge requires 3-D Secure", async () => {
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
});
