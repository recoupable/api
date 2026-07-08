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

const { processSubscriptionUpdated } = await import("@/lib/stripe/processSubscriptionUpdated");

const sub = (overrides: object = {}): Stripe.Subscription =>
  ({ id: "sub_1", customer: "cus_9", cancel_at_period_end: false, ...overrides }) as unknown as
    Stripe.Subscription;

const prev = (attrs: object): Partial<Stripe.Subscription> =>
  attrs as Partial<Stripe.Subscription>;

describe("processSubscriptionUpdated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildContextMock.mockResolvedValue({
      email: "fan@example.com",
      customerLine: "Customer: fan@example.com (cus_9)",
      planLine: "Plan: $99.00/month",
      lifetimeLine: "Lifetime value: $0.00",
    });
  });

  it("notifies churn scheduled on the false→true cancel_at_period_end flip", async () => {
    await processSubscriptionUpdated(
      sub({
        cancel_at_period_end: true,
        cancel_at: 1783415103,
        cancellation_details: { feedback: "too_expensive", reason: "cancellation_requested" },
      }),
      prev({ cancel_at_period_end: false }),
    );

    expect(sendMock).toHaveBeenCalledTimes(1);
    const { text } = sendMock.mock.calls[0][0];
    expect(text).toContain("Churn scheduled");
    expect(text).toContain("Cancels: 2026-07-07");
    expect(text).toContain("Feedback: too_expensive");
    expect(text).toContain("Lifetime value: $0.00");
  });

  it("notifies customer saved on the true→false flip", async () => {
    await processSubscriptionUpdated(
      sub({ cancel_at_period_end: false }),
      prev({ cancel_at_period_end: true }),
    );

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].text).toContain("Cancellation withdrawn");
  });

  it("stays silent on updates that do not flip cancel_at_period_end (e.g. metadata)", async () => {
    await processSubscriptionUpdated(sub(), prev({ metadata: { foo: "bar" } }));
    expect(sendMock).not.toHaveBeenCalled();
    expect(buildContextMock).not.toHaveBeenCalled();
  });

  it("stays silent when previous_attributes is undefined", async () => {
    await processSubscriptionUpdated(sub({ cancel_at_period_end: true }), undefined);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
