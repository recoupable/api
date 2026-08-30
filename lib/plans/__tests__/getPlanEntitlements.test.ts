import { describe, expect, it } from "vitest";
import { getPlanEntitlements } from "@/lib/plans/getPlanEntitlements";
import { DEFAULT_CREDITS_USD, PRO_CREDITS_USD, STARTER_CREDITS_USD } from "@/lib/credits/const";

describe("getPlanEntitlements", () => {
  it("free: 1 task, weekly, the free credit allotment", () => {
    expect(getPlanEntitlements("free")).toEqual({
      credits_usd: DEFAULT_CREDITS_USD,
      task_limit: 1,
      min_cadence_minutes: 10080,
    });
  });

  it("starter: 3 tasks, daily, $20", () => {
    expect(getPlanEntitlements("starter")).toEqual({
      credits_usd: STARTER_CREDITS_USD,
      task_limit: 3,
      min_cadence_minutes: 1440,
    });
    expect(STARTER_CREDITS_USD).toBe(20);
  });

  it("pro: uncapped tasks, hourly, 3x the $99 price", () => {
    expect(getPlanEntitlements("pro")).toEqual({
      credits_usd: PRO_CREDITS_USD,
      task_limit: null,
      min_cadence_minutes: 60,
    });
    expect(PRO_CREDITS_USD).toBe(300);
  });
});
