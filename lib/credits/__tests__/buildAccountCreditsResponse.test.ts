import { describe, it, expect } from "vitest";
import { buildAccountCreditsResponse } from "@/lib/credits/buildAccountCreditsResponse";
import { DEFAULT_CREDITS, PRO_CREDITS } from "@/lib/credits/const";

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

describe("buildAccountCreditsResponse", () => {
  it("returns total_credits = DEFAULT_CREDITS and used_credits = total - remaining for a free account", () => {
    const result = buildAccountCreditsResponse({
      creditsUsage: {
        id: 1,
        account_id: ACCOUNT,
        remaining_credits: 300,
        timestamp: "2026-05-01T12:00:00.000Z",
      },
      isPro: false,
    });

    expect(result).toEqual({
      account_id: ACCOUNT,
      remaining_credits: 300,
      total_credits: DEFAULT_CREDITS,
      used_credits: DEFAULT_CREDITS - 300,
      is_pro: false,
      timestamp: "2026-05-01T12:00:00.000Z",
    });
  });

  it("returns total_credits = PRO_CREDITS for a pro account", () => {
    const result = buildAccountCreditsResponse({
      creditsUsage: {
        id: 1,
        account_id: ACCOUNT,
        remaining_credits: 800,
        timestamp: "2026-05-01T12:00:00.000Z",
      },
      isPro: true,
    });

    expect(result).toEqual({
      account_id: ACCOUNT,
      remaining_credits: 800,
      total_credits: PRO_CREDITS,
      used_credits: PRO_CREDITS - 800,
      is_pro: true,
      timestamp: "2026-05-01T12:00:00.000Z",
    });
  });

  it("clamps used_credits to 0 when remaining_credits exceeds the plan total", () => {
    const result = buildAccountCreditsResponse({
      creditsUsage: {
        id: 1,
        account_id: ACCOUNT,
        remaining_credits: DEFAULT_CREDITS + 50,
        timestamp: null,
      },
      isPro: false,
    });

    expect(result.used_credits).toBe(0);
  });

  it("preserves a null timestamp", () => {
    const result = buildAccountCreditsResponse({
      creditsUsage: {
        id: 1,
        account_id: ACCOUNT,
        remaining_credits: DEFAULT_CREDITS,
        timestamp: null,
      },
      isPro: false,
    });

    expect(result.timestamp).toBeNull();
  });
});
