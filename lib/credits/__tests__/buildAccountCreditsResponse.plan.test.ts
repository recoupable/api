import { describe, expect, it } from "vitest";
import { buildAccountCreditsResponse } from "@/lib/credits/buildAccountCreditsResponse";
import { DEFAULT_CREDITS, PRO_CREDITS, STARTER_CREDITS } from "@/lib/credits/const";

const usage = (remaining: number) =>
  ({
    account_id: "acc",
    remaining_credits: remaining,
    timestamp: "2026-08-01T00:00:00.000Z",
  }) as never;

describe("buildAccountCreditsResponse plan fields", () => {
  it("starter: STARTER_CREDITS total, is_pro false, 3 daily tasks", () => {
    expect(
      buildAccountCreditsResponse({ creditsUsage: usage(1_000_000), plan: "starter" }),
    ).toEqual({
      account_id: "acc",
      remaining_credits: 1_000_000,
      total_credits: STARTER_CREDITS,
      used_credits: STARTER_CREDITS - 1_000_000,
      is_pro: false,
      plan: "starter",
      task_limit: 3,
      min_cadence_minutes: 1440,
      timestamp: "2026-08-01T00:00:00.000Z",
    });
  });

  it("free and pro carry their entitlements", () => {
    expect(buildAccountCreditsResponse({ creditsUsage: usage(0), plan: "free" })).toMatchObject({
      total_credits: DEFAULT_CREDITS,
      is_pro: false,
      plan: "free",
      task_limit: 1,
      min_cadence_minutes: 10080,
    });
    expect(buildAccountCreditsResponse({ creditsUsage: usage(0), plan: "pro" })).toMatchObject({
      total_credits: PRO_CREDITS,
      is_pro: true,
      plan: "pro",
      task_limit: null,
      min_cadence_minutes: 60,
    });
  });
});
