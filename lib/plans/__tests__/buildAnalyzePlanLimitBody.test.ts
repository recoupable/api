import { describe, expect, it } from "vitest";
import { buildAnalyzePlanLimitBody } from "@/lib/plans/buildAnalyzePlanLimitBody";
import { PLAN_BILLING_URL } from "@/lib/credits/const";

describe("buildAnalyzePlanLimitBody", () => {
  it("shapes the documented 402 for a free account at its cap", () => {
    expect(buildAnalyzePlanLimitBody({ plan: "free", currentAnalyzeCount: 5 })).toEqual({
      status: "error",
      error: "plan_limit",
      limit: "analyze_count",
      message: "Free includes 5 tracks analyzed a month. Starter and Pro are unlimited.",
      plan: "free",
      analyze_limit: 5,
      current_analyze_count: 5,
      billingUrl: PLAN_BILLING_URL,
    });
  });
});
