import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  selectCreditsUsageMock,
  resolveStripeCustomerMock,
  createCreditsSessionMock,
  checkAndResetCreditsMock,
} = vi.hoisted(() => ({
  selectCreditsUsageMock: vi.fn(),
  resolveStripeCustomerMock: vi.fn(),
  createCreditsSessionMock: vi.fn(),
  checkAndResetCreditsMock: vi.fn(),
}));

vi.mock("@/lib/supabase/credits_usage/selectCreditsUsage", () => ({
  selectCreditsUsage: selectCreditsUsageMock,
}));
// Mocked only so the assertions below can prove they are never reached.
vi.mock("@/lib/stripe/resolveStripeCustomerForAccount", () => ({
  resolveStripeCustomerForAccount: resolveStripeCustomerMock,
}));
vi.mock("@/lib/stripe/createCreditsStripeSession", () => ({
  createCreditsStripeSession: createCreditsSessionMock,
}));
vi.mock("@/lib/credits/checkAndResetCredits", () => ({
  checkAndResetCredits: checkAndResetCreditsMock,
}));

const { checkCreditsAvailable } = await import("@/lib/credits/checkCreditsAvailable");

const params = { accountId: "acct_123", creditsToDeduct: 5 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  // Default: no refill due — the row comes back unchanged.
  checkAndResetCreditsMock.mockImplementation(async () => ({
    creditsUsage: { remaining_credits: 0 },
    isPro: false,
  }));
});

describe("checkCreditsAvailable", () => {
  it("returns available when the balance covers the cost", async () => {
    selectCreditsUsageMock.mockResolvedValue([{ remaining_credits: 100 }]);

    expect(await checkCreditsAvailable(params)).toEqual({ kind: "available" });
  });

  it("returns insufficient_credits with the balance and the cost, and nothing else", async () => {
    selectCreditsUsageMock.mockResolvedValue([{ remaining_credits: 2 }]);
    checkAndResetCreditsMock.mockResolvedValue({
      creditsUsage: { remaining_credits: 2 },
      isPro: false,
    });

    expect(await checkCreditsAvailable(params)).toEqual({
      kind: "insufficient_credits",
      remainingCredits: 2,
      requiredCredits: 5,
    });
  });

  it("creates no Stripe object when the balance is short", async () => {
    selectCreditsUsageMock.mockResolvedValue([{ remaining_credits: 0 }]);

    await checkCreditsAvailable(params);

    expect(createCreditsSessionMock).not.toHaveBeenCalled();
    expect(resolveStripeCustomerMock).not.toHaveBeenCalled();
  });

  it("stays free of Stripe across repeated shortfalls, so an unattended caller creates nothing", async () => {
    selectCreditsUsageMock.mockResolvedValue([{ remaining_credits: 0 }]);

    for (let i = 0; i < 20; i += 1) await checkCreditsAvailable(params);

    expect(createCreditsSessionMock).toHaveBeenCalledTimes(0);
    expect(resolveStripeCustomerMock).toHaveBeenCalledTimes(0);
  });

  it("treats an empty credits_usage row as a zero balance", async () => {
    selectCreditsUsageMock.mockResolvedValue([]);
    checkAndResetCreditsMock.mockResolvedValue({ creditsUsage: null, isPro: false });

    expect(await checkCreditsAvailable({ ...params, creditsToDeduct: 1 })).toEqual({
      kind: "insufficient_credits",
      remainingCredits: 0,
      requiredCredits: 1,
    });
  });

  it("returns available when the balance exactly equals the cost", async () => {
    selectCreditsUsageMock.mockResolvedValue([{ remaining_credits: 5 }]);

    expect(await checkCreditsAvailable(params)).toEqual({ kind: "available" });
  });

  describe("a due-but-unapplied monthly refill", () => {
    it("is applied on a shortfall, so the first gated request after the boundary passes", async () => {
      selectCreditsUsageMock.mockResolvedValue([{ remaining_credits: 0 }]);
      checkAndResetCreditsMock.mockResolvedValue({
        creditsUsage: { remaining_credits: 333 },
        isPro: false,
      });

      expect(await checkCreditsAvailable(params)).toEqual({ kind: "available" });
      expect(checkAndResetCreditsMock).toHaveBeenCalledWith("acct_123");
    });

    it("still 402s with the refreshed balance when the refilled total does not cover the cost", async () => {
      selectCreditsUsageMock.mockResolvedValue([{ remaining_credits: 0 }]);
      checkAndResetCreditsMock.mockResolvedValue({
        creditsUsage: { remaining_credits: 3 },
        isPro: false,
      });

      expect(await checkCreditsAvailable(params)).toEqual({
        kind: "insufficient_credits",
        remainingCredits: 3,
        requiredCredits: 5,
      });
    });

    it("is not consulted on the happy path — a sufficient balance stays a single read", async () => {
      selectCreditsUsageMock.mockResolvedValue([{ remaining_credits: 100 }]);

      await checkCreditsAvailable(params);

      expect(checkAndResetCreditsMock).not.toHaveBeenCalled();
    });

    it("treats a missing row from the refill check as a zero balance", async () => {
      selectCreditsUsageMock.mockResolvedValue([]);
      checkAndResetCreditsMock.mockResolvedValue({ creditsUsage: null, isPro: false });

      expect(await checkCreditsAvailable({ ...params, creditsToDeduct: 1 })).toEqual({
        kind: "insufficient_credits",
        remainingCredits: 0,
        requiredCredits: 1,
      });
    });
  });
});
