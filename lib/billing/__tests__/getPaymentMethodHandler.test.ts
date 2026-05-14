import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getPaymentMethodHandler } from "@/lib/billing/getPaymentMethodHandler";
import { validateGetPaymentMethodParams } from "@/lib/billing/validateGetPaymentMethodParams";
import { findStripeCustomerForAccount } from "@/lib/stripe/findStripeCustomerForAccount";
import { getDefaultPaymentMethodDetails } from "@/lib/stripe/getDefaultPaymentMethodDetails";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/billing/validateGetPaymentMethodParams", () => ({
  validateGetPaymentMethodParams: vi.fn(),
}));

vi.mock("@/lib/stripe/findStripeCustomerForAccount", () => ({
  findStripeCustomerForAccount: vi.fn(),
}));

vi.mock("@/lib/stripe/getDefaultPaymentMethodDetails", () => ({
  getDefaultPaymentMethodDetails: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

const buildRequest = () =>
  new NextRequest(`http://localhost/api/accounts/${ACCOUNT}/payment-method`);
const buildParams = () => Promise.resolve({ id: ACCOUNT });

beforeEach(() => vi.clearAllMocks());

describe("getPaymentMethodHandler", () => {
  it("returns 200 with the saved card when the account has one on file", async () => {
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(ACCOUNT);
    vi.mocked(findStripeCustomerForAccount).mockResolvedValue("cus_x");
    vi.mocked(getDefaultPaymentMethodDetails).mockResolvedValue({
      brand: "visa",
      last4: "4242",
      exp_month: 12,
      exp_year: 2026,
      funding: "credit",
    });

    const res = await getPaymentMethodHandler(buildRequest(), buildParams());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      account_id: ACCOUNT,
      card: {
        brand: "visa",
        last4: "4242",
        exp_month: 12,
        exp_year: 2026,
        funding: "credit",
      },
    });
    expect(findStripeCustomerForAccount).toHaveBeenCalledWith(ACCOUNT);
    expect(getDefaultPaymentMethodDetails).toHaveBeenCalledWith("cus_x");
  });

  it("returns 200 with card: null when the customer exists but has no payment method", async () => {
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(ACCOUNT);
    vi.mocked(findStripeCustomerForAccount).mockResolvedValue("cus_y");
    vi.mocked(getDefaultPaymentMethodDetails).mockResolvedValue(null);

    const res = await getPaymentMethodHandler(buildRequest(), buildParams());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ account_id: ACCOUNT, card: null });
  });

  it("returns 200 with card: null AND skips the PM lookup when no Stripe customer exists yet", async () => {
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(ACCOUNT);
    vi.mocked(findStripeCustomerForAccount).mockResolvedValue(null);

    const res = await getPaymentMethodHandler(buildRequest(), buildParams());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ account_id: ACCOUNT, card: null });
    // Critical: a GET must not have the side-effect of creating a Stripe Customer.
    expect(getDefaultPaymentMethodDetails).not.toHaveBeenCalled();
  });

  it("forwards a 401 from validation as { error } with the original status", async () => {
    const denial = NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(denial);

    const res = await getPaymentMethodHandler(buildRequest(), buildParams());

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(findStripeCustomerForAccount).not.toHaveBeenCalled();
  });

  it("forwards a 403 from validation", async () => {
    const denial = NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(denial);

    const res = await getPaymentMethodHandler(buildRequest(), buildParams());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("falls back to a default error message when the validation response body isn't JSON", async () => {
    // Upstream is always JSON in practice, but `.json()` throws on an empty/
    // malformed body. Guard ensures we never propagate a parse error.
    const denial = new NextResponse("", { status: 401 });
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(denial);

    const res = await getPaymentMethodHandler(buildRequest(), buildParams());

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 500 with masked internal-error when an upstream throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(ACCOUNT);
    vi.mocked(findStripeCustomerForAccount).mockRejectedValue(new Error("stripe-down"));

    const res = await getPaymentMethodHandler(buildRequest(), buildParams());

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
