import { describe, it, expect, vi, beforeEach } from "vitest";

const { selectCreditsUsageMock, resolveStripeCustomerMock, createCreditsSessionMock } = vi.hoisted(
  () => ({
    selectCreditsUsageMock: vi.fn(),
    resolveStripeCustomerMock: vi.fn(),
    createCreditsSessionMock: vi.fn(),
  }),
);

vi.mock("@/lib/supabase/credits_usage/selectCreditsUsage", () => ({
  selectCreditsUsage: selectCreditsUsageMock,
}));
vi.mock("@/lib/stripe/resolveStripeCustomerForAccount", () => ({
  resolveStripeCustomerForAccount: resolveStripeCustomerMock,
}));
vi.mock("@/lib/stripe/createCreditsStripeSession", () => ({
  createCreditsStripeSession: createCreditsSessionMock,
}));

const { checkCreditsAvailable } = await import("@/lib/credits/checkCreditsAvailable");

const params = {
  accountId: "acct_123",
  creditsToDeduct: 5,
  successUrl: "https://chat.recoupable.dev/settings/profile",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  resolveStripeCustomerMock.mockResolvedValue("cus_x");
});

describe("checkCreditsAvailable", () => {
  it("returns available when balance covers the cost (no Stripe calls)", async () => {
    selectCreditsUsageMock.mockResolvedValue([{ remaining_credits: 100 }]);

    const result = await checkCreditsAvailable(params);

    expect(result).toEqual({ kind: "available" });
    expect(resolveStripeCustomerMock).not.toHaveBeenCalled();
    expect(createCreditsSessionMock).not.toHaveBeenCalled();
  });

  it("returns insufficient_credits with a checkout url when the balance is short", async () => {
    selectCreditsUsageMock.mockResolvedValue([{ remaining_credits: 2 }]);
    createCreditsSessionMock.mockResolvedValue({
      id: "cs_x",
      url: "https://pay.recoupable.com/c/pay/cs_x",
    });

    const result = await checkCreditsAvailable(params);

    expect(result).toEqual({
      kind: "insufficient_credits",
      remainingCredits: 2,
      requiredCredits: 5,
      checkoutUrl: "https://pay.recoupable.com/c/pay/cs_x",
    });
  });

  it("returns the same insufficient_credits result regardless of the account's Stripe state", async () => {
    selectCreditsUsageMock.mockResolvedValue([{ remaining_credits: 0 }]);
    createCreditsSessionMock.mockResolvedValue({ id: "cs_z", url: "https://x/z" });

    const result = await checkCreditsAvailable(params);

    expect(result).toMatchObject({ kind: "insufficient_credits", remainingCredits: 0 });
  });

  it("never returns a declineReason", async () => {
    selectCreditsUsageMock.mockResolvedValue([{ remaining_credits: 1 }]);
    createCreditsSessionMock.mockResolvedValue({ id: "cs_d", url: "https://x/d" });

    const result = await checkCreditsAvailable(params);

    expect(result).not.toHaveProperty("declineReason");
  });

  it("treats an empty credits_usage row as a zero balance", async () => {
    selectCreditsUsageMock.mockResolvedValue([]);
    createCreditsSessionMock.mockResolvedValue({ id: "cs_e", url: "https://x/e" });

    const result = await checkCreditsAvailable({ ...params, creditsToDeduct: 1 });

    expect(result).toEqual({
      kind: "insufficient_credits",
      remainingCredits: 0,
      requiredCredits: 1,
      checkoutUrl: "https://x/e",
    });
  });

  it("throws when createCreditsStripeSession returns no url (not a usable 402)", async () => {
    selectCreditsUsageMock.mockResolvedValue([{ remaining_credits: 0 }]);
    createCreditsSessionMock.mockResolvedValue({ id: "cs_nourl", url: null });

    await expect(checkCreditsAvailable(params)).rejects.toThrow(
      /createCreditsStripeSession returned no url/,
    );
  });
});
