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

const { processSubscriptionCreated } = await import("@/lib/stripe/processSubscriptionCreated");

const CTX = {
  email: "fan@example.com",
  customerLine: "Customer: fan@example.com (cus_9)",
  planLine: "Plan: $99.00/month",
  lifetimeLine: "Lifetime value: $0.00",
};

const sub = (overrides: object = {}): Stripe.Subscription =>
  ({
    id: "sub_1",
    customer: "cus_9",
    status: "active",
    ...overrides,
  }) as unknown as Stripe.Subscription;

describe("processSubscriptionCreated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildContextMock.mockResolvedValue(CTX);
  });

  it("notifies a trial signup with the trial end date (new card on file)", async () => {
    await processSubscriptionCreated(sub({ status: "trialing", trial_end: 1783415103 }));

    expect(sendMock).toHaveBeenCalledTimes(1);
    const { email, text } = sendMock.mock.calls[0][0];
    expect(email).toBe("fan@example.com");
    expect(text).toContain("New subscription (trial)");
    expect(text).toContain("Customer: fan@example.com (cus_9)");
    expect(text).toContain("Plan: $99.00/month");
    expect(text).toContain("Trial ends: 2026-07-07");
    expect(text).toContain("Lifetime value: $0.00");
  });

  it("notifies a direct (non-trial) subscription without a trial line", async () => {
    await processSubscriptionCreated(sub());

    const { text } = sendMock.mock.calls[0][0];
    expect(text).toContain("New subscription");
    expect(text).not.toContain("(trial)");
    expect(text).not.toContain("Trial ends");
  });
});
