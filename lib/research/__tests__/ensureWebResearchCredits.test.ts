import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { ensureCreditsMock } = vi.hoisted(() => ({
  ensureCreditsMock: vi.fn(),
}));

vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: ensureCreditsMock,
}));

const { ensureWebResearchCredits } = await import("@/lib/research/ensureWebResearchCredits");

describe("ensureWebResearchCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gates with exactly 1 credit (web search is repriced below the research family)", async () => {
    ensureCreditsMock.mockResolvedValue(null);

    await expect(ensureWebResearchCredits("acct")).resolves.toBeNull();
    expect(ensureCreditsMock).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "acct", creditsToDeduct: 1 }),
    );
  });

  it("forwards the 402 short-circuit response", async () => {
    const short = NextResponse.json({ error: "Payment Required" }, { status: 402 });
    ensureCreditsMock.mockResolvedValue(short);

    await expect(ensureWebResearchCredits("acct")).resolves.toBe(short);
  });
});
