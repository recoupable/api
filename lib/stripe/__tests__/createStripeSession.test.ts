import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  STRIPE_SUBSCRIPTION_PRICE_ID,
  STRIPE_SUBSCRIPTION_TRIAL_PERIOD_DAYS,
} from "@/lib/stripe/config";

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

  it("resolves the Customer for the account before creating the Checkout session", async () => {
    await createStripeSession("acc-1", "https://example.com/success");
    expect(resolveStripeCustomerForAccountMock).toHaveBeenCalledWith("acc-1");
    expect(resolveStripeCustomerForAccountMock).toHaveBeenCalledBefore(checkoutSessionsCreate);
  });

  it("passes the resolved customer plus the expected params to Stripe", async () => {
    await createStripeSession("acc-1", "https://example.com/success");

    expect(checkoutSessionsCreate).toHaveBeenCalledWith({
      customer: "cus_acc1",
      line_items: [{ price: STRIPE_SUBSCRIPTION_PRICE_ID, quantity: 1 }],
      mode: "subscription",
      client_reference_id: "acc-1",
      metadata: { accountId: "acc-1" },
      subscription_data: {
        metadata: { accountId: "acc-1" },
        trial_period_days: STRIPE_SUBSCRIPTION_TRIAL_PERIOD_DAYS,
      },
      success_url: "https://example.com/success",
    });
  });

  it("does not set cancel_url, customer_email, promo or billing-collection fields", async () => {
    await createStripeSession("acc-1", "https://example.com/success");
    const params = checkoutSessionsCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(params).not.toHaveProperty("cancel_url");
    expect(params).not.toHaveProperty("customer_email");
    expect(params).not.toHaveProperty("allow_promotion_codes");
    expect(params).not.toHaveProperty("billing_address_collection");
    expect(params.client_reference_id).toBe("acc-1");
  });
});
