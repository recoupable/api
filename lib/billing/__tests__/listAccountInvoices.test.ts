import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

const { invoicesList, invoicesRetrieve } = vi.hoisted(() => ({
  invoicesList: vi.fn(),
  invoicesRetrieve: vi.fn(),
}));

vi.mock("@/lib/stripe/client", () => ({
  default: { invoices: { list: invoicesList, retrieve: invoicesRetrieve } },
}));

const { listAccountInvoices } = await import("@/lib/billing/listAccountInvoices");

const list = (data: unknown[], has_more = false) =>
  ({
    object: "list",
    data,
    has_more,
    url: "/v1/invoices",
  }) as unknown as Stripe.ApiList<Stripe.Invoice>;

const inv = (id: string, created: number) => ({ id, created });

describe("listAccountInvoices", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists invoices for a single customer with the limit and no cursor", async () => {
    invoicesList.mockResolvedValue(list([inv("in_1", 30)]));

    const result = await listAccountInvoices({ customerIds: ["cus_x"], limit: 20 });

    expect(invoicesList).toHaveBeenCalledWith({ customer: "cus_x", limit: 20 });
    expect(invoicesRetrieve).not.toHaveBeenCalled();
    expect(result.invoices.map(i => i.id)).toEqual(["in_1"]);
    expect(result.hasMore).toBe(false);
  });

  it("merges invoices across customers newest first and caps at the limit", async () => {
    invoicesList
      .mockResolvedValueOnce(list([inv("in_a2", 300), inv("in_a1", 100)]))
      .mockResolvedValueOnce(list([inv("in_b1", 200), inv("in_b0", 50)]));

    const result = await listAccountInvoices({ customerIds: ["cus_a", "cus_b"], limit: 3 });

    expect(invoicesList).toHaveBeenCalledWith({ customer: "cus_a", limit: 3 });
    expect(invoicesList).toHaveBeenCalledWith({ customer: "cus_b", limit: 3 });
    expect(result.invoices.map(i => i.id)).toEqual(["in_a2", "in_b1", "in_a1"]);
    expect(result.hasMore).toBe(true);
  });

  it("reports hasMore when any customer has a further page", async () => {
    invoicesList
      .mockResolvedValueOnce(list([inv("in_a1", 100)], true))
      .mockResolvedValueOnce(list([]));

    const result = await listAccountInvoices({ customerIds: ["cus_a", "cus_b"], limit: 20 });

    expect(result.invoices.map(i => i.id)).toEqual(["in_a1"]);
    expect(result.hasMore).toBe(true);
  });

  it("pages by the cursor invoice's creation time so the cursor works across customers", async () => {
    invoicesRetrieve.mockResolvedValue({ id: "in_cursor", created: 200 });
    invoicesList
      .mockResolvedValueOnce(list([inv("in_a1", 100)]))
      .mockResolvedValueOnce(list([inv("in_b0", 50)]));

    const result = await listAccountInvoices({
      customerIds: ["cus_a", "cus_b"],
      limit: 20,
      startingAfter: "in_cursor",
    });

    expect(invoicesRetrieve).toHaveBeenCalledWith("in_cursor");
    expect(invoicesList).toHaveBeenCalledWith({
      customer: "cus_a",
      limit: 20,
      created: { lt: 200 },
    });
    expect(invoicesList).toHaveBeenCalledWith({
      customer: "cus_b",
      limit: 20,
      created: { lt: 200 },
    });
    expect(result.invoices.map(i => i.id)).toEqual(["in_a1", "in_b0"]);
  });

  it("returns an empty page without calling Stripe when there are no customers", async () => {
    const result = await listAccountInvoices({ customerIds: [], limit: 20 });

    expect(invoicesList).not.toHaveBeenCalled();
    expect(result).toEqual({ invoices: [], hasMore: false });
  });
});
