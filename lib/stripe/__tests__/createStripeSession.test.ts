import { describe, it, expect, vi, beforeEach } from "vitest";
import { createStripeSession } from "../createStripeSession";
import stripeClient from "@/lib/stripe/client";
import { generateUUID } from "@/lib/uuid/generateUUID";

vi.mock("@/lib/stripe/client", () => ({
  default: {
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
  },
}));

vi.mock("@/lib/uuid/generateUUID", () => ({
  generateUUID: vi.fn(() => "test-uuid-1234"),
}));

vi.mock("@/lib/const", () => ({
  STRIPE_SUBSCRIPTION_PRICE_ID: "price_test_123",
}));

const mockCreate = vi.mocked(stripeClient.checkout.sessions.create);

describe("createStripeSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns session id and url on success", async () => {
    mockCreate.mockResolvedValue({
      id: "cs_test_abc123",
      url: "https://checkout.stripe.com/pay/cs_test_abc123",
    } as never);

    const result = await createStripeSession(
      "account-uuid-111",
      "https://chat.recoupable.com?subscription=success",
    );

    expect(result).toEqual({
      id: "cs_test_abc123",
      url: "https://checkout.stripe.com/pay/cs_test_abc123",
    });
  });

  it("calls stripe with correct parameters", async () => {
    mockCreate.mockResolvedValue({
      id: "cs_test_abc123",
      url: "https://checkout.stripe.com/pay/cs_test_abc123",
    } as never);

    await createStripeSession("account-uuid-111", "https://chat.recoupable.com?success=1");

    expect(mockCreate).toHaveBeenCalledWith({
      line_items: [{ price: "price_test_123", quantity: 1 }],
      mode: "subscription",
      client_reference_id: "test-uuid-1234",
      metadata: { accountId: "account-uuid-111" },
      subscription_data: {
        metadata: { accountId: "account-uuid-111" },
        trial_period_days: 30,
      },
      success_url: "https://chat.recoupable.com?success=1",
    });
  });

  it("uses generateUUID for client_reference_id", async () => {
    mockCreate.mockResolvedValue({
      id: "cs_test_abc123",
      url: "https://checkout.stripe.com/pay/cs_test_abc123",
    } as never);

    await createStripeSession("account-uuid-111", "https://example.com");

    expect(generateUUID).toHaveBeenCalledOnce();
  });

  it("throws when stripe session returns no url", async () => {
    mockCreate.mockResolvedValue({ id: "cs_test_abc123", url: null } as never);

    await expect(createStripeSession("account-uuid-111", "https://example.com")).rejects.toThrow(
      "Stripe session was created but returned no URL",
    );
  });

  it("throws when stripe api call fails", async () => {
    mockCreate.mockRejectedValue(new Error("Stripe API error"));

    await expect(createStripeSession("account-uuid-111", "https://example.com")).rejects.toThrow(
      "Stripe API error",
    );
  });
});
