import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { buildPaymentsResponse } from "@/lib/billing/buildPaymentsResponse";

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

const invoice = (overrides: Record<string, unknown> = {}): Stripe.Invoice =>
  ({
    id: "in_1",
    created: 1788000000,
    amount_due: 9900,
    currency: "usd",
    status: "paid",
    hosted_invoice_url: "https://invoice.stripe.com/i/x",
    lines: { data: [{ description: "Pro, monthly" }] },
    ...overrides,
  }) as unknown as Stripe.Invoice;

describe("buildPaymentsResponse", () => {
  it("maps invoices to the documented row shape", () => {
    const res = buildPaymentsResponse({
      accountId: ACCOUNT,
      invoices: [invoice()],
      hasMore: true,
    });

    expect(res).toEqual({
      account_id: ACCOUNT,
      payments: [
        {
          id: "in_1",
          createdAt: "2026-08-29T10:40:00.000Z",
          description: "Pro, monthly",
          amountCents: 9900,
          currency: "usd",
          status: "paid",
          url: "https://invoice.stripe.com/i/x",
        },
      ],
      hasMore: true,
    });
  });

  it("returns an empty list for no invoices", () => {
    expect(buildPaymentsResponse({ accountId: ACCOUNT, invoices: [], hasMore: false })).toEqual({
      account_id: ACCOUNT,
      payments: [],
      hasMore: false,
    });
  });
});
