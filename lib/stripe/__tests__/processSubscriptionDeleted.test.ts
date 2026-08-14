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

const { processSubscriptionDeleted } = await import("@/lib/stripe/processSubscriptionDeleted");

describe("processSubscriptionDeleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildContextMock.mockResolvedValue({
      email: "fan@example.com",
      customerLine: "Customer: fan@example.com (cus_9)",
      planLine: "Plan: $99.00/month",
      lifetimeLine: "Lifetime value: $0.00",
    });
  });

  it("notifies final churn with cancellation feedback", async () => {
    await processSubscriptionDeleted({
      id: "sub_1",
      customer: "cus_9",
      cancellation_details: { feedback: "too_expensive", reason: "cancellation_requested" },
    } as unknown as Stripe.Subscription);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const { email, text } = sendMock.mock.calls[0][0];
    expect(email).toBe("fan@example.com");
    expect(text).toContain("Subscription canceled");
    expect(text).toContain("Feedback: too_expensive");
    expect(text).toContain("Lifetime value: $0.00");
  });

  it("omits the feedback line when Stripe has none", async () => {
    await processSubscriptionDeleted({
      id: "sub_1",
      customer: "cus_9",
      cancellation_details: { feedback: null, reason: null },
    } as unknown as Stripe.Subscription);

    expect(sendMock.mock.calls[0][0].text).not.toContain("Feedback:");
  });
});
