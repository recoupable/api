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

const { notifyCreditsTopupSession } = await import("@/lib/stripe/notifyCreditsTopupSession");

const session = (overrides: object = {}): Stripe.Checkout.Session =>
  ({
    id: "cs_1",
    mode: "payment",
    payment_status: "paid",
    customer: "cus_9",
    customer_details: { email: "fan@example.com" },
    amount_total: 2000,
    metadata: { purpose: "credits_topup", credits: "500" },
    ...overrides,
  }) as unknown as Stripe.Checkout.Session;

describe("notifyCreditsTopupSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildCustomerContextMock.mockResolvedValue({
      email: "fan@example.com",
      customerLine: "Customer: fan@example.com (cus_9)",
      lifetimeLine: "Lifetime value: $20.00",
      lifetimeCents: 2000,
    });
  });

  it("notifies a paid manual credits top-up", async () => {
    await notifyCreditsTopupSession(session());

    expect(sendMock).toHaveBeenCalledTimes(1);
    const { email, text } = sendMock.mock.calls[0][0];
    expect(email).toBe("fan@example.com");
    expect(text).toContain("top-up");
    expect(text).toContain("Amount: $20.00");
    expect(text).toContain("Credits: 500");
    expect(text).toContain("Lifetime value: $20.00");
    expect(buildCustomerContextMock).toHaveBeenCalledWith("cus_9", "fan@example.com");
  });

  it("stays silent for sessions that are not credits top-ups", async () => {
    await notifyCreditsTopupSession(session({ metadata: { purpose: "other" } }));
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("stays silent for unpaid sessions", async () => {
    await notifyCreditsTopupSession(session({ payment_status: "unpaid" }));
    expect(sendMock).not.toHaveBeenCalled();
  });
});
