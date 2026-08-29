import { describe, it, expect, vi, beforeEach } from "vitest";

const { createMock, resolveCustomerMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  resolveCustomerMock: vi.fn(),
}));
vi.mock("@/lib/stripe/client", () => ({
  default: { checkout: { sessions: { create: createMock } } },
}));
vi.mock("@/lib/stripe/resolveStripeCustomerForAccount", () => ({
  resolveStripeCustomerForAccount: resolveCustomerMock,
}));

const { createCheckoutSession } = await import("../createCheckoutSession");

describe("createCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMock.mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.com/c/1" });
    resolveCustomerMock.mockResolvedValue("cus_1");
  });

  it("mints an anonymous session that creates a customer and carries the plan in metadata", async () => {
    await createCheckoutSession({
      accountId: null,
      plan: "pro",
      price: { price: "price_pro", trialPeriodDays: 30 },
      successUrl: "https://app/?s={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://site/pricing",
    });

    expect(resolveCustomerMock).not.toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledWith({
      mode: "subscription",
      line_items: [{ price: "price_pro", quantity: 1 }],
      customer_creation: "always",
      metadata: { plan: "pro", source: "checkout_unauth" },
      subscription_data: {
        metadata: { plan: "pro", source: "checkout_unauth" },
        trial_period_days: 30,
      },
      success_url: "https://app/?s={CHECKOUT_SESSION_ID}",
      cancel_url: "https://site/pricing",
    });
  });

  it("attaches the account customer and accountId metadata when authenticated, with no trial for Starter", async () => {
    await createCheckoutSession({
      accountId: "acc_1",
      plan: "starter",
      price: { price: "price_starter" },
      successUrl: "https://app/",
    });

    expect(resolveCustomerMock).toHaveBeenCalledWith("acc_1");
    const params = createMock.mock.calls[0][0];
    expect(params.customer).toBe("cus_1");
    expect(params.client_reference_id).toBe("acc_1");
    expect(params.metadata).toEqual({ accountId: "acc_1", plan: "starter" });
    expect(params.subscription_data).toEqual({ metadata: { accountId: "acc_1", plan: "starter" } });
    expect(params).not.toHaveProperty("customer_creation");
    expect(params).not.toHaveProperty("cancel_url");
  });
});
