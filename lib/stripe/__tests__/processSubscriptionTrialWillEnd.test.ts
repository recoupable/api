import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

const { buildContextMock, sendMock } = vi.hoisted(() => ({
  buildContextMock: vi.fn(),
  sendMock: vi.fn(),
}));

vi.mock("@/lib/stripe/buildSubscriptionSalesContext", () => ({
  buildSubscriptionSalesContext: buildContextMock,
}));
vi.mock("@/lib/telegram/sendSalesNotification", () => ({ sendSalesNotification: sendMock }));

const { processSubscriptionTrialWillEnd } = await import(
  "@/lib/stripe/processSubscriptionTrialWillEnd"
);

describe("processSubscriptionTrialWillEnd", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildContextMock.mockResolvedValue({
      email: "fan@example.com",
      customerLine: "Customer: fan@example.com (cus_9)",
      planLine: "Plan: $99.00/month",
      lifetimeLine: "Lifetime value: $0.00",
    });
  });

  it("notifies that the trial is ending with the conversion date", async () => {
    await processSubscriptionTrialWillEnd({
      id: "sub_1",
      trial_end: 1783415103,
    } as unknown as Stripe.Subscription);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const { email, text } = sendMock.mock.calls[0][0];
    expect(email).toBe("fan@example.com");
    expect(text).toContain("Trial ending soon");
    expect(text).toContain("reach out now");
    expect(text).toContain("Trial ends: 2026-07-07");
    expect(text).toContain("Lifetime value: $0.00");
  });
});
