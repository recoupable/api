import { describe, it, expect, vi, beforeEach } from "vitest";

const { checkoutSessionsCreate, resolveStripeCustomerForAccountMock } = vi.hoisted(() => ({
  checkoutSessionsCreate: vi.fn(),
  resolveStripeCustomerForAccountMock: vi.fn(),
}));

vi.mock("@/lib/stripe/client", () => ({
  default: {
    checkout: { sessions: { create: checkoutSessionsCreate } },
  },
}));

vi.mock("@/lib/stripe/resolveStripeCustomerForAccount", () => ({
  resolveStripeCustomerForAccount: resolveStripeCustomerForAccountMock,
}));

const { createStripeSession } = await import("@/lib/stripe/createStripeSession");

describe("createStripeSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkoutSessionsCreate.mockResolvedValue({ id: "cs_x", url: "https://checkout.stripe.com/x" });
    resolveStripeCustomerForAccountMock.mockResolvedValue("cus_acc1");
  });

  it("mints an anonymous session with no customer and the plan in metadata", async () => {
    await createStripeSession({
      accountId: null,
      plan: "pro",
      price: { price: "price_pro", trialPeriodDays: 30 },
      successUrl: "https://app/?s={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://site/pricing",
    });

    expect(resolveStripeCustomerForAccountMock).not.toHaveBeenCalled();
    expect(checkoutSessionsCreate).toHaveBeenCalledWith({
      mode: "subscription",
      line_items: [{ price: "price_pro", quantity: 1 }],
      metadata: { plan: "pro", source: "checkout_unauth" },
      subscription_data: {
        metadata: { plan: "pro", source: "checkout_unauth" },
        trial_period_days: 30,
      },
      success_url: "https://app/?s={CHECKOUT_SESSION_ID}",
      cancel_url: "https://site/pricing",
    });
  });

  it("attaches the account customer and accountId metadata when authenticated", async () => {
    await createStripeSession({
      accountId: "acc-1",
      plan: "starter",
      price: { price: "price_starter" },
      successUrl: "https://example.com/success",
    });

    expect(resolveStripeCustomerForAccountMock).toHaveBeenCalledWith("acc-1");
    const params = checkoutSessionsCreate.mock.calls[0][0];
    expect(params.customer).toBe("cus_acc1");
    expect(params.client_reference_id).toBe("acc-1");
    expect(params.metadata).toEqual({ accountId: "acc-1", plan: "starter" });
    expect(params.subscription_data).toEqual({
      metadata: { accountId: "acc-1", plan: "starter" },
    });
    expect(params).not.toHaveProperty("cancel_url");
  });
});
