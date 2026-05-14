import { describe, it, expect, vi, beforeEach } from "vitest";

const { autoRechargeOrFailMock } = vi.hoisted(() => ({
  autoRechargeOrFailMock: vi.fn(),
}));

vi.mock("@/lib/credits/autoRechargeOrFail", () => ({
  autoRechargeOrFail: autoRechargeOrFailMock,
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "access-control-allow-origin": "*" }),
}));

const { ensureCreditsOrShortCircuit } = await import("@/lib/credits/ensureCreditsOrShortCircuit");

const params = {
  accountId: "acct_123",
  creditsToDeduct: 5,
  successUrl: "https://chat.recoupable.com/credits/success",
};

beforeEach(() => vi.clearAllMocks());

describe("ensureCreditsOrShortCircuit", () => {
  it("returns null when autoRechargeOrFail signals available credits", async () => {
    autoRechargeOrFailMock.mockResolvedValue({ kind: "available" });
    const result = await ensureCreditsOrShortCircuit(params);
    expect(result).toBeNull();
  });

  it("returns 402 with checkoutUrl and no declineReason when no card was on file", async () => {
    autoRechargeOrFailMock.mockResolvedValue({
      kind: "insufficient_credits",
      remainingCredits: 2,
      requiredCredits: 5,
      checkoutUrl: "https://pay.recoupable.com/c/pay/cs_x",
    });

    const response = await ensureCreditsOrShortCircuit(params);
    expect(response).not.toBeNull();
    expect(response?.status).toBe(402);
    await expect(response!.json()).resolves.toEqual({
      error: "insufficient_credits",
      remaining_credits: 2,
      required_credits: 5,
      checkoutUrl: "https://pay.recoupable.com/c/pay/cs_x",
    });
  });

  it("returns 402 with declineReason when Stripe declined the auto-recharge", async () => {
    const declineReason = {
      code: "card_declined",
      declineCode: "insufficient_funds",
      message: "Your card has insufficient funds.",
    };
    autoRechargeOrFailMock.mockResolvedValue({
      kind: "insufficient_credits",
      remainingCredits: 2,
      requiredCredits: 5,
      checkoutUrl: "https://pay.recoupable.com/c/pay/cs_y",
      declineReason,
    });

    const response = await ensureCreditsOrShortCircuit(params);
    expect(response?.status).toBe(402);
    await expect(response!.json()).resolves.toEqual({
      error: "insufficient_credits",
      remaining_credits: 2,
      required_credits: 5,
      checkoutUrl: "https://pay.recoupable.com/c/pay/cs_y",
      declineReason,
    });
  });
});
