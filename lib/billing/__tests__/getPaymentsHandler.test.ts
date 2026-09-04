import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getPaymentsHandler } from "@/lib/billing/getPaymentsHandler";
import { validateGetPaymentsParams } from "@/lib/billing/validateGetPaymentsParams";
import { findStripeCustomerForAccount } from "@/lib/stripe/findStripeCustomerForAccount";
import { listAccountInvoices } from "@/lib/billing/listAccountInvoices";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/billing/validateGetPaymentsParams", () => ({
  validateGetPaymentsParams: vi.fn(),
}));
vi.mock("@/lib/stripe/findStripeCustomerForAccount", () => ({
  findStripeCustomerForAccount: vi.fn(),
}));
vi.mock("@/lib/billing/listAccountInvoices", () => ({
  listAccountInvoices: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const buildRequest = () => new NextRequest(`http://localhost/api/accounts/${ACCOUNT}/payments`);
const buildParams = () => Promise.resolve({ id: ACCOUNT });

beforeEach(() => vi.clearAllMocks());

describe("getPaymentsHandler", () => {
  it("returns 200 with mapped invoices when the account has a customer", async () => {
    vi.mocked(validateGetPaymentsParams).mockResolvedValue({
      accountId: ACCOUNT,
      limit: 20,
      startingAfter: undefined,
    });
    vi.mocked(findStripeCustomerForAccount).mockResolvedValue("cus_x");
    vi.mocked(listAccountInvoices).mockResolvedValue({
      invoices: [
        {
          id: "in_1",
          created: 1788000000,
          amount_due: 9900,
          currency: "usd",
          status: "paid",
          hosted_invoice_url: "https://invoice.stripe.com/i/x",
          lines: { data: [{ description: "Pro, monthly" }] },
        } as never,
      ],
      hasMore: false,
    });

    const res = await getPaymentsHandler(buildRequest(), buildParams());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.account_id).toBe(ACCOUNT);
    expect(body.payments).toHaveLength(1);
    expect(body.payments[0].id).toBe("in_1");
    expect(body.hasMore).toBe(false);
    expect(listAccountInvoices).toHaveBeenCalledWith({
      customerId: "cus_x",
      limit: 20,
      startingAfter: undefined,
    });
  });

  it("returns 200 with an empty list and skips Stripe when no customer exists", async () => {
    vi.mocked(validateGetPaymentsParams).mockResolvedValue({
      accountId: ACCOUNT,
      limit: 20,
      startingAfter: undefined,
    });
    vi.mocked(findStripeCustomerForAccount).mockResolvedValue(null);

    const res = await getPaymentsHandler(buildRequest(), buildParams());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      account_id: ACCOUNT,
      payments: [],
      hasMore: false,
    });
    expect(listAccountInvoices).not.toHaveBeenCalled();
  });

  it("forwards validation failures with the { error } shape", async () => {
    vi.mocked(validateGetPaymentsParams).mockResolvedValue(
      NextResponse.json({ message: "Forbidden" }, { status: 403 }),
    );

    const res = await getPaymentsHandler(buildRequest(), buildParams());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
    expect(findStripeCustomerForAccount).not.toHaveBeenCalled();
  });

  it("returns 500 with a generic message when Stripe throws", async () => {
    vi.mocked(validateGetPaymentsParams).mockResolvedValue({
      accountId: ACCOUNT,
      limit: 20,
      startingAfter: undefined,
    });
    vi.mocked(findStripeCustomerForAccount).mockResolvedValue("cus_x");
    vi.mocked(listAccountInvoices).mockRejectedValue(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await getPaymentsHandler(buildRequest(), buildParams());

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
    spy.mockRestore();
  });
});
