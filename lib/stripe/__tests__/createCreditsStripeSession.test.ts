import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCreditsStripeSession } from "@/lib/stripe/createCreditsStripeSession";

const { checkoutSessionsCreate } = vi.hoisted(() => ({
  checkoutSessionsCreate: vi.fn(),
}));

vi.mock("@/lib/stripe/client", () => ({
  default: {
    checkout: { sessions: { create: checkoutSessionsCreate } },
  },
}));

describe("createCreditsStripeSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkoutSessionsCreate.mockResolvedValue({
      id: "cs_x",
      url: "https://checkout.stripe.com/x",
    });
  });

  it("creates a one-time payment checkout with dynamic price_data at 1 cent per credit", async () => {
    await createCreditsStripeSession({
      accountId: "acc-1",
      credits: 250,
      successUrl: "https://example.com/success",
    });

    expect(checkoutSessionsCreate).toHaveBeenCalledWith({
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: 1,
            product_data: { name: "Recoup credits" },
          },
          quantity: 250,
        },
      ],
      mode: "payment",
      client_reference_id: "acc-1",
      metadata: {
        accountId: "acc-1",
        credits: "250",
        purpose: "credits_topup",
      },
      payment_intent_data: {
        metadata: {
          accountId: "acc-1",
          credits: "250",
          purpose: "credits_topup",
        },
      },
      success_url: "https://example.com/success",
    });
  });

  it("does not set cancel_url, customer_email, or promo fields", async () => {
    await createCreditsStripeSession({
      accountId: "acc-1",
      credits: 100,
      successUrl: "https://example.com/success",
    });
    const params = checkoutSessionsCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(params).not.toHaveProperty("cancel_url");
    expect(params).not.toHaveProperty("customer_email");
    expect(params).not.toHaveProperty("allow_promotion_codes");
    expect(params).not.toHaveProperty("subscription_data");
    expect(params.mode).toBe("payment");
  });
});
