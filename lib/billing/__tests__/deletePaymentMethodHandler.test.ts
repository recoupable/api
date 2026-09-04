import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { deletePaymentMethodHandler } from "@/lib/billing/deletePaymentMethodHandler";
import { validateGetPaymentMethodParams } from "@/lib/billing/validateGetPaymentMethodParams";
import { findStripeCustomerForAccount } from "@/lib/stripe/findStripeCustomerForAccount";
import { findDefaultCardForCustomer } from "@/lib/stripe/findDefaultCardForCustomer";
import { detachPaymentMethod } from "@/lib/stripe/detachPaymentMethod";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/billing/validateGetPaymentMethodParams", () => ({
  validateGetPaymentMethodParams: vi.fn(),
}));
vi.mock("@/lib/stripe/findStripeCustomerForAccount", () => ({
  findStripeCustomerForAccount: vi.fn(),
}));
vi.mock("@/lib/stripe/findDefaultCardForCustomer", () => ({
  findDefaultCardForCustomer: vi.fn(),
}));
vi.mock("@/lib/stripe/detachPaymentMethod", () => ({ detachPaymentMethod: vi.fn() }));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const buildRequest = () =>
  new NextRequest(`http://localhost/api/accounts/${ACCOUNT}/payment-method`, {
    method: "DELETE",
  });
const buildParams = () => Promise.resolve({ id: ACCOUNT });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("deletePaymentMethodHandler", () => {
  it("detaches the default card and returns 204 with no body", async () => {
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(ACCOUNT);
    vi.mocked(findStripeCustomerForAccount).mockResolvedValue("cus_x");
    vi.mocked(findDefaultCardForCustomer).mockResolvedValue("pm_1");
    vi.mocked(detachPaymentMethod).mockResolvedValue(undefined);

    const res = await deletePaymentMethodHandler(buildRequest(), buildParams());

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(detachPaymentMethod).toHaveBeenCalledWith("pm_1");
  });

  it("returns 404 when the account has no Stripe customer", async () => {
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(ACCOUNT);
    vi.mocked(findStripeCustomerForAccount).mockResolvedValue(null);

    const res = await deletePaymentMethodHandler(buildRequest(), buildParams());

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "No payment method on file" });
    expect(detachPaymentMethod).not.toHaveBeenCalled();
  });

  it("returns 404 when the customer has no default card (a non-card default counts as none)", async () => {
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(ACCOUNT);
    vi.mocked(findStripeCustomerForAccount).mockResolvedValue("cus_x");
    vi.mocked(findDefaultCardForCustomer).mockResolvedValue(null);

    const res = await deletePaymentMethodHandler(buildRequest(), buildParams());

    expect(res.status).toBe(404);
    expect(detachPaymentMethod).not.toHaveBeenCalled();
  });

  it("forwards an auth denial as { error } with the original status", async () => {
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(
      NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 }),
    );
    const res = await deletePaymentMethodHandler(buildRequest(), buildParams());
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
    expect(findStripeCustomerForAccount).not.toHaveBeenCalled();
  });

  it("returns 500 with a masked message when Stripe throws", async () => {
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(ACCOUNT);
    vi.mocked(findStripeCustomerForAccount).mockRejectedValue(new Error("stripe-down"));
    const res = await deletePaymentMethodHandler(buildRequest(), buildParams());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
