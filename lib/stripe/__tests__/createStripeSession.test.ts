import { describe, it, expect, vi, beforeEach } from "vitest";
import { createStripeSession } from "../createStripeSession";
import stripeClient from "@/lib/stripe/client";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

vi.mock("@/lib/stripe/client", () => ({
  default: {
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
  },
}));

vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: vi.fn(),
}));

const mockCreate = vi.mocked(stripeClient.checkout.sessions.create);
const mockSelectAccountEmails = vi.mocked(selectAccountEmails);

describe("createStripeSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectAccountEmails.mockResolvedValue([{ email: "artist@recoupable.com" } as never]);
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
      line_items: [{ price: "price_1RyDFD00JObOnOb53PcVOeBz", quantity: 1 }],
      mode: "subscription",
      client_reference_id: "account-uuid-111",
      metadata: { accountId: "account-uuid-111" },
      customer_email: "artist@recoupable.com",
      cancel_url: "https://chat.recoupable.com?success=1",
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      subscription_data: {
        metadata: { accountId: "account-uuid-111" },
        trial_period_days: 30,
      },
      success_url: "https://chat.recoupable.com?success=1",
    });
  });

  it("uses accountId as client_reference_id", async () => {
    mockCreate.mockResolvedValue({
      id: "cs_test_abc123",
      url: "https://checkout.stripe.com/pay/cs_test_abc123",
    } as never);

    await createStripeSession("account-uuid-111", "https://example.com");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ client_reference_id: "account-uuid-111" }),
    );
  });

  it("does not set customer_email when account has no email", async () => {
    mockSelectAccountEmails.mockResolvedValue([]);
    mockCreate.mockResolvedValue({
      id: "cs_test_abc123",
      url: "https://checkout.stripe.com/pay/cs_test_abc123",
    } as never);

    await createStripeSession("account-uuid-111", "https://example.com");

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ customer_email: undefined }));
  });

  it("does not set customer_email when account email is null", async () => {
    mockSelectAccountEmails.mockResolvedValue([{ email: null } as never]);
    mockCreate.mockResolvedValue({
      id: "cs_test_abc123",
      url: "https://checkout.stripe.com/pay/cs_test_abc123",
    } as never);

    await createStripeSession("account-uuid-111", "https://example.com");

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ customer_email: undefined }));
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
