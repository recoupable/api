import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

const { buildCustomerContextMock, sendMock } = vi.hoisted(() => ({
  buildCustomerContextMock: vi.fn(),
  sendMock: vi.fn(),
}));

vi.mock("@/lib/stripe/buildCustomerSalesContext", () => ({
  buildCustomerSalesContext: buildCustomerContextMock,
}));
vi.mock("@/lib/telegram/sendSalesNotification", () => ({ sendSalesNotification: sendMock }));

const { processInvoicePaid } = await import("@/lib/stripe/processInvoicePaid");

const ctx = (lifetimeCents: number) => ({
  email: "fan@example.com",
  customerLine: "Customer: fan@example.com (cus_9)",
  lifetimeLine: `Lifetime value: $${(lifetimeCents / 100).toFixed(2)}`,
  lifetimeCents,
});

const invoice = (overrides: object = {}): Stripe.Invoice =>
  ({
    id: "in_1",
    customer: "cus_9",
    customer_email: "fan@example.com",
    amount_paid: 9900,
    billing_reason: "subscription_cycle",
    ...overrides,
  }) as unknown as Stripe.Invoice;

describe("processInvoicePaid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildCustomerContextMock.mockResolvedValue(ctx(9900));
  });

  it("stays silent for $0 invoices (trial-start invoices)", async () => {
    await processInvoicePaid(invoice({ amount_paid: 0 }));
    expect(sendMock).not.toHaveBeenCalled();
    expect(buildCustomerContextMock).not.toHaveBeenCalled();
  });

  it("labels a trial conversion as the first payment (prior lifetime value $0)", async () => {
    buildCustomerContextMock.mockResolvedValue(ctx(9900));
    await processInvoicePaid(invoice());

    expect(sendMock).toHaveBeenCalledTimes(1);
    const { email, text } = sendMock.mock.calls[0][0];
    expect(email).toBe("fan@example.com");
    expect(text).toContain("First subscription payment");
    expect(text).toContain("Amount: $99.00");
    expect(text).toContain("Lifetime value: $99.00");
  });

  it("labels later payments as recurring", async () => {
    buildCustomerContextMock.mockResolvedValue(ctx(19800));
    await processInvoicePaid(invoice());

    const { text } = sendMock.mock.calls[0][0];
    expect(text).toContain("recurring");
    expect(text).not.toContain("First subscription payment");
  });

  it("passes the invoice's customer_email to the context builder", async () => {
    await processInvoicePaid(invoice());
    expect(buildCustomerContextMock).toHaveBeenCalledWith("cus_9", "fan@example.com");
  });
});
