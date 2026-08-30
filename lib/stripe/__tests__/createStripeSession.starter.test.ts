import { beforeEach, describe, expect, it, vi } from "vitest";

const { checkoutSessionsCreate, resolveMock, config } = vi.hoisted(() => ({
  checkoutSessionsCreate: vi.fn(),
  resolveMock: vi.fn(),
  config: {
    STRIPE_STARTER_PRICE_ID: "price_starter",
    STRIPE_SUBSCRIPTION_PRICE_ID: "price_pro",
    STRIPE_SUBSCRIPTION_TRIAL_PERIOD_DAYS: 30,
  },
}));
vi.mock("@/lib/stripe/client", () => ({
  default: { checkout: { sessions: { create: checkoutSessionsCreate } } },
}));
vi.mock("@/lib/stripe/resolveStripeCustomerForAccount", () => ({
  resolveStripeCustomerForAccount: resolveMock,
}));
vi.mock("@/lib/stripe/config", () => config);

const { createStripeSession } = await import("@/lib/stripe/createStripeSession");
const { StarterUnavailableError } = await import("@/lib/stripe/StarterUnavailableError");

describe("createStripeSession starter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    config.STRIPE_STARTER_PRICE_ID = "price_starter";
    checkoutSessionsCreate.mockResolvedValue({ id: "cs_x", url: "https://checkout.stripe.com/x" });
    resolveMock.mockResolvedValue("cus_1");
  });

  it("starter uses the Starter price, no trial, and stamps plan on both metadata blocks", async () => {
    await createStripeSession("acc-1", "https://example.com/ok", "starter");
    expect(checkoutSessionsCreate).toHaveBeenCalledWith({
      customer: "cus_1",
      line_items: [{ price: "price_starter", quantity: 1 }],
      mode: "subscription",
      client_reference_id: "acc-1",
      metadata: { accountId: "acc-1", plan: "starter" },
      subscription_data: { metadata: { accountId: "acc-1", plan: "starter" } },
      success_url: "https://example.com/ok",
    });
  });

  it("pro (default) keeps the trial and stamps plan pro", async () => {
    await createStripeSession("acc-1", "https://example.com/ok");
    const params = checkoutSessionsCreate.mock.calls[0][0];
    expect(params.line_items).toEqual([{ price: "price_pro", quantity: 1 }]);
    expect(params.subscription_data).toEqual({
      metadata: { accountId: "acc-1", plan: "pro" },
      trial_period_days: 30,
    });
  });

  it("throws StarterUnavailableError before touching Stripe when the price is unset", async () => {
    config.STRIPE_STARTER_PRICE_ID = "";
    await expect(
      createStripeSession("acc-1", "https://example.com/ok", "starter"),
    ).rejects.toBeInstanceOf(StarterUnavailableError);
    expect(resolveMock).not.toHaveBeenCalled();
    expect(checkoutSessionsCreate).not.toHaveBeenCalled();
  });
});
