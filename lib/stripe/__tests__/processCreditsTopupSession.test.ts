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

const session = (overrides: Record<string, unknown> = {}): Stripe.Checkout.Session =>
  ({
    id: "cs_test_123",
    mode: "payment",
    payment_status: "paid",
    metadata: { accountId: ACCOUNT, credits: "250", purpose: "credits_topup" },
    ...overrides,
  }) as unknown as Stripe.Checkout.Session;

describe("processCreditsTopupSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => vi.mocked(console.warn).mockRestore());

  it("credits the account when session is paid + has correct metadata", async () => {
    incrementRemainingCreditsMock.mockResolvedValue({
      account_id: ACCOUNT,
      remaining_credits: 350,
    });
    await processCreditsTopupSession(session());
    expect(incrementRemainingCreditsMock).toHaveBeenCalledWith({ accountId: ACCOUNT, delta: 250 });
  });

  it.each([
    ["mode != payment", { mode: "subscription" }],
    [
      "purpose != credits_topup",
      { metadata: { accountId: ACCOUNT, credits: "250", purpose: "x" } },
    ],
    ["payment_status != paid", { payment_status: "unpaid" }],
  ])("skips when %s", async (_label, overrides) => {
    await processCreditsTopupSession(session(overrides));
    expect(incrementRemainingCreditsMock).not.toHaveBeenCalled();
  });

  it.each([
    ["accountId missing", { metadata: { credits: "250", purpose: "credits_topup" } }, /accountId/],
    ["credits missing", { metadata: { accountId: ACCOUNT, purpose: "credits_topup" } }, /credits/],
    [
      "credits non-numeric",
      { metadata: { accountId: ACCOUNT, credits: "abc", purpose: "credits_topup" } },
      /credits/,
    ],
    [
      "credits = 0",
      { metadata: { accountId: ACCOUNT, credits: "0", purpose: "credits_topup" } },
      /credits/,
    ],
  ])("throws when %s", async (_label, overrides, matcher) => {
    await expect(processCreditsTopupSession(session(overrides))).rejects.toThrow(matcher);
    expect(incrementRemainingCreditsMock).not.toHaveBeenCalled();
  });
});
