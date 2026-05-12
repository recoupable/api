import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type Stripe from "stripe";
import { processCreditsTopupSession } from "@/lib/stripe/processCreditsTopupSession";

const { incrementRemainingCreditsMock } = vi.hoisted(() => ({
  incrementRemainingCreditsMock: vi.fn(),
}));

vi.mock("@/lib/supabase/credits_usage/incrementRemainingCredits", () => ({
  incrementRemainingCredits: incrementRemainingCreditsMock,
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

const buildSession = (overrides: Record<string, unknown> = {}): Stripe.Checkout.Session =>
  ({
    id: "cs_test_123",
    mode: "payment",
    payment_status: "paid",
    metadata: {
      accountId: ACCOUNT,
      credits: "250",
      purpose: "credits_topup",
    },
    ...overrides,
  }) as unknown as Stripe.Checkout.Session;

describe("processCreditsTopupSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.mocked(console.error).mockRestore();
    vi.mocked(console.warn).mockRestore();
  });

  it("credits the account when session is paid + has correct metadata", async () => {
    incrementRemainingCreditsMock.mockResolvedValue({
      account_id: ACCOUNT,
      remaining_credits: 350,
    });

    await processCreditsTopupSession(buildSession());

    expect(incrementRemainingCreditsMock).toHaveBeenCalledWith({
      accountId: ACCOUNT,
      delta: 250,
    });
  });

  it("skips when mode is not 'payment' (e.g. subscription checkout)", async () => {
    await processCreditsTopupSession(buildSession({ mode: "subscription" }));
    expect(incrementRemainingCreditsMock).not.toHaveBeenCalled();
  });

  it("skips when purpose metadata is not credits_topup", async () => {
    await processCreditsTopupSession(
      buildSession({
        metadata: { accountId: ACCOUNT, credits: "250", purpose: "other" },
      }),
    );
    expect(incrementRemainingCreditsMock).not.toHaveBeenCalled();
  });

  it("skips when payment_status is not 'paid'", async () => {
    await processCreditsTopupSession(buildSession({ payment_status: "unpaid" }));
    expect(incrementRemainingCreditsMock).not.toHaveBeenCalled();
  });

  it("throws when accountId metadata is missing on a paid credits_topup session", async () => {
    await expect(
      processCreditsTopupSession(
        buildSession({
          metadata: { credits: "250", purpose: "credits_topup" },
        }),
      ),
    ).rejects.toThrow(/accountId/);
    expect(incrementRemainingCreditsMock).not.toHaveBeenCalled();
  });

  it("throws when credits metadata is missing or not a positive integer", async () => {
    await expect(
      processCreditsTopupSession(
        buildSession({
          metadata: { accountId: ACCOUNT, purpose: "credits_topup" },
        }),
      ),
    ).rejects.toThrow(/credits/);

    await expect(
      processCreditsTopupSession(
        buildSession({
          metadata: { accountId: ACCOUNT, credits: "abc", purpose: "credits_topup" },
        }),
      ),
    ).rejects.toThrow(/credits/);

    await expect(
      processCreditsTopupSession(
        buildSession({
          metadata: { accountId: ACCOUNT, credits: "0", purpose: "credits_topup" },
        }),
      ),
    ).rejects.toThrow(/credits/);

    expect(incrementRemainingCreditsMock).not.toHaveBeenCalled();
  });
});
