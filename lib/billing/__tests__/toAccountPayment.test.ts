import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { toAccountPayment } from "@/lib/billing/toAccountPayment";

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

describe("toAccountPayment", () => {
  it("maps an invoice to the documented row shape", () => {
    expect(toAccountPayment(invoice())).toEqual({
      id: "in_1",
      createdAt: "2026-08-29T10:40:00.000Z",
      description: "Pro, monthly",
      amountCents: 9900,
      currency: "usd",
      status: "paid",
      url: "https://invoice.stripe.com/i/x",
    });
  });

  it("falls back to the price nickname, then 'Invoice', for the description", () => {
    const nick = invoice({
      lines: { data: [{ description: null, price: { nickname: "Starter" } }] },
    });
    const bare = invoice({ lines: { data: [] } });
    expect([nick, bare].map(toAccountPayment).map(p => p.description)).toEqual([
      "Starter",
      "Invoice",
    ]);
  });

  it("returns url: null and status draft for a draft with no hosted url", () => {
    const row = toAccountPayment(invoice({ hosted_invoice_url: null, status: "draft" }));
    expect(row.url).toBeNull();
    expect(row.status).toBe("draft");
  });
});
