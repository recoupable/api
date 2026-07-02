import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

import { ensureSocialScrapeCredits } from "../ensureSocialScrapeCredits";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";

vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: vi.fn(),
}));

const ACCOUNT_ID = "770e8400-e29b-41d4-a716-446655440000";

describe("ensureSocialScrapeCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ensureCreditsOrShortCircuit).mockResolvedValue(null);
  });

  it("gates on the given credit amount", async () => {
    expect(await ensureSocialScrapeCredits(ACCOUNT_ID, 25)).toBeNull();
    expect(ensureCreditsOrShortCircuit).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: ACCOUNT_ID, creditsToDeduct: 25 }),
    );
  });

  it("passes through the 402 short-circuit response", async () => {
    const short = NextResponse.json({}, { status: 402 });
    vi.mocked(ensureCreditsOrShortCircuit).mockResolvedValue(short);
    expect(await ensureSocialScrapeCredits(ACCOUNT_ID, 5)).toBe(short);
  });
});
