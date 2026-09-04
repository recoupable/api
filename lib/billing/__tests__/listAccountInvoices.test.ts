import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

const { invoicesList } = vi.hoisted(() => ({ invoicesList: vi.fn() }));

vi.mock("@/lib/stripe/client", () => ({
  default: { invoices: { list: invoicesList } },
}));

const { listAccountInvoices } = await import("@/lib/billing/listAccountInvoices");

const list = (data: unknown[], has_more = false) =>
  ({
    object: "list",
    data,
    has_more,
    url: "/v1/invoices",
  }) as unknown as Stripe.ApiList<Stripe.Invoice>;

describe("listAccountInvoices", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists invoices for the customer with limit and cursor", async () => {
    invoicesList.mockResolvedValue(list([{ id: "in_1" }], true));

    const result = await listAccountInvoices({
      customerId: "cus_x",
      limit: 5,
      startingAfter: "in_0",
    });

    expect(invoicesList).toHaveBeenCalledWith({
      customer: "cus_x",
      limit: 5,
      starting_after: "in_0",
    });
    expect(result.invoices.map(i => i.id)).toEqual(["in_1"]);
    expect(result.hasMore).toBe(true);
  });

  it("omits starting_after when no cursor is given", async () => {
    invoicesList.mockResolvedValue(list([]));

    const result = await listAccountInvoices({ customerId: "cus_x", limit: 20 });

    expect(invoicesList).toHaveBeenCalledWith({ customer: "cus_x", limit: 20 });
    expect(result).toEqual({ invoices: [], hasMore: false });
  });
});
