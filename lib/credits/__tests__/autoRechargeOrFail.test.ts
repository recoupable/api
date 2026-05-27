import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  selectCreditsUsageMock,
  incrementMock,
  resolveStripeCustomerMock,
  chargeOffSessionMock,
  createCreditsSessionMock,
  computeChargeMock,
} = vi.hoisted(() => ({
  selectCreditsUsageMock: vi.fn(),
  incrementMock: vi.fn(),
  resolveStripeCustomerMock: vi.fn(),
  chargeOffSessionMock: vi.fn(),
  createCreditsSessionMock: vi.fn(),
  computeChargeMock: vi.fn(),
}));

vi.mock("@/lib/supabase/credits_usage/selectCreditsUsage", () => ({
  selectCreditsUsage: selectCreditsUsageMock,
}));
vi.mock("@/lib/supabase/credits_usage/incrementRemainingCredits", () => ({
  incrementRemainingCredits: incrementMock,
}));
vi.mock("@/lib/stripe/resolveStripeCustomerForAccount", () => ({
  resolveStripeCustomerForAccount: resolveStripeCustomerMock,
}));
vi.mock("@/lib/stripe/chargeCustomerOffSession", () => ({
  chargeCustomerOffSession: chargeOffSessionMock,
}));
vi.mock("@/lib/stripe/createCreditsStripeSession", () => ({
  createCreditsStripeSession: createCreditsSessionMock,
}));
vi.mock("@/lib/stripe/computeCreditsTopupCharge", () => ({
  computeCreditsTopupCharge: computeChargeMock,
}));

const { autoRechargeOrFail } = await import("@/lib/credits/autoRechargeOrFail");

const params = {
  accountId: "acct_123",
  creditsToDeduct: 5,
  successUrl: "https://chat.recoupable.com/credits/success",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  computeChargeMock.mockReturnValue({ totalCents: 534 });
  resolveStripeCustomerMock.mockResolvedValue("cus_x");
});

describe("autoRechargeOrFail", () => {
  it("returns available when balance covers the cost (no Stripe calls)", async () => {
    selectCreditsUsageMock.mockResolvedValue([{ remaining_credits: 100 }]);

    const result = await autoRechargeOrFail(params);

    expect(result).toEqual({ kind: "available" });
    expect(chargeOffSessionMock).not.toHaveBeenCalled();
    expect(incrementMock).not.toHaveBeenCalled();
    expect(createCreditsSessionMock).not.toHaveBeenCalled();
  });

  it("auto-charges and increments when balance is short and card succeeds", async () => {
    selectCreditsUsageMock.mockResolvedValue([{ remaining_credits: 2 }]);
    chargeOffSessionMock.mockResolvedValue({ kind: "charged", paymentIntentId: "pi_ok" });

    const result = await autoRechargeOrFail(params);

    expect(result).toEqual({ kind: "available" });
    expect(chargeOffSessionMock).toHaveBeenCalledWith({
      customer: "cus_x",
      totalCents: 534,
      metadata: { accountId: "acct_123", credits: "500", purpose: "credits_auto_recharge" },
    });
    expect(incrementMock).toHaveBeenCalledWith({ accountId: "acct_123", delta: 500 });
    expect(createCreditsSessionMock).not.toHaveBeenCalled();
  });

  it("returns insufficient_credits + checkoutUrl when no card is on file (no declineReason)", async () => {
    selectCreditsUsageMock.mockResolvedValue([{ remaining_credits: 2 }]);
    chargeOffSessionMock.mockResolvedValue({ kind: "no_payment_method" });
    createCreditsSessionMock.mockResolvedValue({
      id: "cs_x",
      url: "https://pay.recoupable.com/c/pay/cs_x",
    });

    const result = await autoRechargeOrFail(params);

    expect(result).toEqual({
      kind: "insufficient_credits",
      remainingCredits: 2,
      requiredCredits: 5,
      checkoutUrl: "https://pay.recoupable.com/c/pay/cs_x",
    });
    expect(incrementMock).not.toHaveBeenCalled();
  });

  it("returns insufficient_credits + checkoutUrl + declineReason when Stripe declines", async () => {
    selectCreditsUsageMock.mockResolvedValue([{ remaining_credits: 2 }]);
    const declineReason = {
      code: "card_declined",
      declineCode: "insufficient_funds",
      message: "Your card has insufficient funds.",
    };
    chargeOffSessionMock.mockResolvedValue({ kind: "requires_action", declineReason });
    createCreditsSessionMock.mockResolvedValue({
      id: "cs_y",
      url: "https://pay.recoupable.com/c/pay/cs_y",
    });

    const result = await autoRechargeOrFail(params);

    expect(result).toEqual({
      kind: "insufficient_credits",
      remainingCredits: 2,
      requiredCredits: 5,
      checkoutUrl: "https://pay.recoupable.com/c/pay/cs_y",
      declineReason,
    });
    expect(incrementMock).not.toHaveBeenCalled();
  });

  it("treats empty credits_usage row as zero balance and falls through to charge attempt", async () => {
    selectCreditsUsageMock.mockResolvedValue([]);
    chargeOffSessionMock.mockResolvedValue({ kind: "no_payment_method" });
    createCreditsSessionMock.mockResolvedValue({
      id: "cs_z",
      url: "https://pay.recoupable.com/c/pay/cs_z",
    });

    const result = await autoRechargeOrFail({ ...params, creditsToDeduct: 1 });

    expect(result).toEqual({
      kind: "insufficient_credits",
      remainingCredits: 0,
      requiredCredits: 1,
      checkoutUrl: "https://pay.recoupable.com/c/pay/cs_z",
    });
  });

  it("credits the top-up even when the request needs MORE than 500 — paid credits must land", async () => {
    selectCreditsUsageMock.mockResolvedValue([{ remaining_credits: 2 }]);
    chargeOffSessionMock.mockResolvedValue({ kind: "charged", paymentIntentId: "pi_big" });
    createCreditsSessionMock.mockResolvedValue({
      id: "cs_big",
      url: "https://pay.recoupable.com/c/pay/cs_big",
    });

    // Request needs 600 credits, balance is 2, top-up adds 500 → still short.
    const result = await autoRechargeOrFail({ ...params, creditsToDeduct: 600 });

    expect(incrementMock).toHaveBeenCalledWith({ accountId: "acct_123", delta: 500 });
    expect(result).toEqual({
      kind: "insufficient_credits",
      remainingCredits: 502,
      requiredCredits: 600,
      checkoutUrl: "https://pay.recoupable.com/c/pay/cs_big",
    });
  });

  it("throws when createCreditsStripeSession returns no url (not a usable 402)", async () => {
    selectCreditsUsageMock.mockResolvedValue([{ remaining_credits: 0 }]);
    chargeOffSessionMock.mockResolvedValue({ kind: "no_payment_method" });
    createCreditsSessionMock.mockResolvedValue({ id: "cs_nourl", url: null });

    await expect(autoRechargeOrFail(params)).rejects.toThrow(
      /createCreditsStripeSession returned no url/,
    );
  });
});
