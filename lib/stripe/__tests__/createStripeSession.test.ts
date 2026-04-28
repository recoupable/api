import { describe, it, expect, vi, beforeEach } from "vitest";
import { createStripeSession } from "../createStripeSession";
import stripeClient from "@/lib/stripe/client";
import { v4 as uuidV4 } from "uuid";

vi.mock("@/lib/stripe/client", () => ({
  default: {
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
  },
}));

vi.mock("uuid", () => ({
  v4: vi.fn(),
}));

const mockCreate = vi.mocked(stripeClient.checkout.sessions.create);
const mockUuidV4 = vi.mocked(uuidV4);

describe("createStripeSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUuidV4.mockReturnValue("uuid-123");
  });

  it("returns the full session object on success", async () => {
    mockCreate.mockResolvedValue({
      id: "cs_test_abc123",
      url: "https://checkout.stripe.com/pay/cs_test_abc123",
      object: "checkout.session",
    } as never);

    const result = await createStripeSession(
      "account-uuid-111",
      "https://chat.recoupable.com?subscription=success",
    );

    expect(result).toMatchObject({
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
      line_items: [{ price: "price_1RyDFD00JObOnOb53PcVOeBz", quantity: 1 }],
      mode: "subscription",
      client_reference_id: "uuid-123",
      metadata: { accountId: "account-uuid-111" },
      subscription_data: {
        metadata: { accountId: "account-uuid-111" },
        trial_period_days: 30,
      },
      success_url: "https://chat.recoupable.com?success=1",
    });
  });

  it("uses a generated uuid as client_reference_id", async () => {
    mockCreate.mockResolvedValue({
      id: "cs_test_abc123",
      url: "https://checkout.stripe.com/pay/cs_test_abc123",
    } as never);

    await createStripeSession("account-uuid-111", "https://example.com");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ client_reference_id: "uuid-123" }),
    );
  });

  it("throws when stripe api call fails", async () => {
    mockCreate.mockRejectedValue(new Error("Stripe API error"));

    await expect(createStripeSession("account-uuid-111", "https://example.com")).rejects.toThrow(
      "Stripe API error",
    );
  });
});
