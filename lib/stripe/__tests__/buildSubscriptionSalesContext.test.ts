import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

const { getCustomerEmailMock, getLtvMock } = vi.hoisted(() => ({
  getCustomerEmailMock: vi.fn(),
  getLtvMock: vi.fn(),
}));

vi.mock("@/lib/stripe/getCustomerEmail", () => ({ getCustomerEmail: getCustomerEmailMock }));
vi.mock("@/lib/stripe/getCustomerLifetimeValue", () => ({
  getCustomerLifetimeValue: getLtvMock,
}));

const { buildSubscriptionSalesContext } = await import(
  "@/lib/stripe/buildSubscriptionSalesContext"
);

const sub = (overrides: object = {}): Stripe.Subscription =>
  ({
    id: "sub_1",
    customer: "cus_9",
    items: {
      data: [{ price: { unit_amount: 9900, recurring: { interval: "month" } } }],
    },
    ...overrides,
  }) as unknown as Stripe.Subscription;

describe("buildSubscriptionSalesContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCustomerEmailMock.mockResolvedValue("fan@example.com");
    getLtvMock.mockResolvedValue(12345);
  });

  it("builds customer, plan, and lifetime lines from the subscription", async () => {
    await expect(buildSubscriptionSalesContext(sub())).resolves.toEqual({
      email: "fan@example.com",
      customerLine: "Customer: fan@example.com (cus_9)",
      planLine: "Plan: $99.00/month",
      lifetimeLine: "Lifetime value: $123.45",
    });
    expect(getCustomerEmailMock).toHaveBeenCalledWith("cus_9");
    expect(getLtvMock).toHaveBeenCalledWith("cus_9");
  });

  it("uses the id when the customer field is an expanded object", async () => {
    const ctx = await buildSubscriptionSalesContext(sub({ customer: { id: "cus_9" } }));
    expect(ctx.customerLine).toBe("Customer: fan@example.com (cus_9)");
  });

  it("falls back to the customer id when no email is found", async () => {
    getCustomerEmailMock.mockResolvedValue(null);
    const ctx = await buildSubscriptionSalesContext(sub());
    expect(ctx.email).toBeNull();
    expect(ctx.customerLine).toBe("Customer: cus_9");
  });

  it("tolerates a subscription without price data", async () => {
    const ctx = await buildSubscriptionSalesContext(sub({ items: { data: [] } }));
    expect(ctx.planLine).toBe("Plan: unknown");
  });
});
