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

const { notifyCreditsTopupPaymentIntent } = await import(
  "@/lib/stripe/notifyCreditsTopupPaymentIntent"
);

const pi = (metadata: object, overrides: object = {}): Stripe.PaymentIntent =>
  ({
    id: "pi_1",
    customer: "cus_9",
    amount: 546,
    metadata,
    ...overrides,
  }) as unknown as Stripe.PaymentIntent;

describe("notifyCreditsTopupPaymentIntent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildCustomerContextMock.mockResolvedValue({
      email: "fan@example.com",
      customerLine: "Customer: fan@example.com (cus_9)",
      lifetimeLine: "Lifetime value: $5.46",
      lifetimeCents: 546,
    });
  });

  it("notifies an auto-recharge with amount and credits", async () => {
    await notifyCreditsTopupPaymentIntent(pi({ purpose: "credits_auto_recharge", credits: "500" }));

    expect(sendMock).toHaveBeenCalledTimes(1);
    const { email, text } = sendMock.mock.calls[0][0];
    expect(email).toBe("fan@example.com");
    expect(text).toContain("auto-recharge");
    expect(text).toContain("Amount: $5.46");
    expect(text).toContain("Credits: 500");
    expect(text).toContain("Lifetime value: $5.46");
  });

  it("stays silent for manual credits_topup PIs (notified via their checkout session)", async () => {
    await notifyCreditsTopupPaymentIntent(pi({ purpose: "credits_topup" }));
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("stays silent for bare PIs without purpose metadata (subscription/checkout charges)", async () => {
    await notifyCreditsTopupPaymentIntent(pi({}));
    expect(sendMock).not.toHaveBeenCalled();
    expect(buildCustomerContextMock).not.toHaveBeenCalled();
  });

  it("stays silent when the PI has no customer", async () => {
    await notifyCreditsTopupPaymentIntent(
      pi({ purpose: "credits_auto_recharge" }, { customer: null }),
    );
    expect(sendMock).not.toHaveBeenCalled();
  });
});
