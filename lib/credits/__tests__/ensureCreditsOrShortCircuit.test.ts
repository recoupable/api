import { describe, it, expect, vi, beforeEach } from "vitest";

const { checkCreditsAvailableMock } = vi.hoisted(() => ({
  checkCreditsAvailableMock: vi.fn(),
}));

vi.mock("@/lib/credits/checkCreditsAvailable", () => ({
  checkCreditsAvailable: checkCreditsAvailableMock,
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "access-control-allow-origin": "*" }),
}));

const { ensureCreditsOrShortCircuit } = await import("@/lib/credits/ensureCreditsOrShortCircuit");

const params = {
  accountId: "acct_123",
  creditsToDeduct: 5,
  successUrl: "https://chat.recoupable.dev/settings/profile",
};

beforeEach(() => vi.clearAllMocks());

describe("ensureCreditsOrShortCircuit", () => {
  it("returns null when checkCreditsAvailable signals available credits", async () => {
    checkCreditsAvailableMock.mockResolvedValue({ kind: "available" });
    const result = await ensureCreditsOrShortCircuit(params);
    expect(result).toBeNull();
  });

  it("returns 402 with checkoutUrl and no declineReason", async () => {
    checkCreditsAvailableMock.mockResolvedValue({
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

  // declineReason only ever existed because the gate charged a card and could be
  // declined. With no charge in the gate, it can never be populated, so it is
  // gone from the envelope rather than left as a field that is always absent.
  it("never puts a declineReason on the 402, even if the gate somehow returns one", async () => {
    checkCreditsAvailableMock.mockResolvedValue({
      kind: "insufficient_credits",
      remainingCredits: 0,
      requiredCredits: 5,
      checkoutUrl: "https://pay.recoupable.com/c/pay/cs_y",
      declineReason: { code: "card_declined", message: "stale" },
    });

    const response = await ensureCreditsOrShortCircuit(params);
    const body = await response!.json();
    expect(body).not.toHaveProperty("declineReason");
  });
});
