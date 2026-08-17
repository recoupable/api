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

const params = { accountId: "acct_123", creditsToDeduct: 5 };

beforeEach(() => vi.clearAllMocks());

describe("ensureCreditsOrShortCircuit", () => {
  it("returns null when checkCreditsAvailable signals available credits", async () => {
    checkCreditsAvailableMock.mockResolvedValue({ kind: "available" });

    expect(await ensureCreditsOrShortCircuit(params)).toBeNull();
  });

  it("returns 402 with a static billingUrl and no checkoutUrl", async () => {
    checkCreditsAvailableMock.mockResolvedValue({
      kind: "insufficient_credits",
      remainingCredits: 2,
      requiredCredits: 5,
    });

    const response = await ensureCreditsOrShortCircuit(params);

    expect(response?.status).toBe(402);
    await expect(response!.json()).resolves.toEqual({
      error: "insufficient_credits",
      remaining_credits: 2,
      required_credits: 5,
      billingUrl: "https://app.recoupable.dev",
    });
  });

  it("passes only the account and the cost through to the gate — no successUrl to plumb", async () => {
    checkCreditsAvailableMock.mockResolvedValue({ kind: "available" });

    await ensureCreditsOrShortCircuit(params);

    expect(checkCreditsAvailableMock).toHaveBeenCalledWith({
      accountId: "acct_123",
      creditsToDeduct: 5,
    });
  });
});
