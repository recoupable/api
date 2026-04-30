import { describe, it, expect, vi, beforeEach } from "vitest";
import { createStripeSession } from "@/lib/stripe/createStripeSession";

const { checkoutSessionsCreate } = vi.hoisted(() => ({
  checkoutSessionsCreate: vi.fn(),
}));

vi.mock("@/lib/stripe/client", () => ({
  default: {
    checkout: { sessions: { create: checkoutSessionsCreate } },
  },
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "00000000-0000-4000-8000-000000000001"),
}));

describe("createStripeSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkoutSessionsCreate.mockResolvedValue({ id: "cs_x", url: "https://checkout.stripe.com/x" });
  });

  it("creates subscription checkout with expected params", async () => {
    await createStripeSession("acc-1", "https://example.com/success");

    expect(checkoutSessionsCreate).toHaveBeenCalledWith({
      line_items: [{ price: "price_1RyDFD00JObOnOb53PcVOeBz", quantity: 1 }],
      mode: "subscription",
      client_reference_id: "00000000-0000-4000-8000-000000000001",
      metadata: { accountId: "acc-1" },
      subscription_data: {
        metadata: { accountId: "acc-1" },
        trial_period_days: 30,
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
    expect(params.client_reference_id).not.toBe("acc-1");
  });
});
