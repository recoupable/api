import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

const { incrementMock } = vi.hoisted(() => ({ incrementMock: vi.fn() }));

vi.mock("@/lib/supabase/credits_usage/incrementRemainingCredits", () => ({
  incrementRemainingCredits: incrementMock,
}));

const { processCreditsTopupPaymentIntent } = await import(
  "@/lib/stripe/processCreditsTopupPaymentIntent"
);

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

const pi = (metadata: Stripe.Metadata): Stripe.PaymentIntent =>
  ({
    id: "pi_x",
    status: "succeeded",
    metadata,
  }) as unknown as Stripe.PaymentIntent;

describe("processCreditsTopupPaymentIntent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("credits the account for an off-session credits_topup PaymentIntent", async () => {
    await processCreditsTopupPaymentIntent(
      pi({
        accountId: ACCOUNT,
        credits: "250",
        purpose: "credits_topup",
        paymentMethod: "off_session",
      }),
    );

    expect(incrementMock).toHaveBeenCalledWith({ accountId: ACCOUNT, delta: 250 });
  });

  it("skips events whose paymentMethod is not off_session (e.g. Checkout flow)", async () => {
    await processCreditsTopupPaymentIntent(
      pi({
        accountId: ACCOUNT,
        credits: "250",
        purpose: "credits_topup",
        paymentMethod: "checkout",
      }),
    );
    expect(incrementMock).not.toHaveBeenCalled();
  });

  it("skips events whose purpose is not credits_topup", async () => {
    await processCreditsTopupPaymentIntent(
      pi({
        accountId: ACCOUNT,
        credits: "250",
        purpose: "other",
        paymentMethod: "off_session",
      }),
    );
    expect(incrementMock).not.toHaveBeenCalled();
  });

  it("throws on missing or invalid metadata", async () => {
    await expect(
      processCreditsTopupPaymentIntent(
        pi({ credits: "250", purpose: "credits_topup", paymentMethod: "off_session" }),
      ),
    ).rejects.toThrow(/accountId/);

    await expect(
      processCreditsTopupPaymentIntent(
        pi({
          accountId: ACCOUNT,
          purpose: "credits_topup",
          paymentMethod: "off_session",
        }),
      ),
    ).rejects.toThrow(/credits/);

    expect(incrementMock).not.toHaveBeenCalled();
  });
});
