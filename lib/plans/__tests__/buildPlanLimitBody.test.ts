import { describe, expect, it } from "vitest";
import { buildPlanLimitBody } from "@/lib/plans/buildPlanLimitBody";
import { PLAN_BILLING_URL } from "@/lib/credits/const";

describe("buildPlanLimitBody", () => {
  it("shapes the documented task_count body", () => {
    expect(buildPlanLimitBody({ plan: "free", limit: "task_count", currentTaskCount: 1 })).toEqual({
      status: "error",
      error: "plan_limit",
      limit: "task_count",
      message: "Free includes 1 task. Starter includes 3, Pro is unlimited.",
      plan: "free",
      task_limit: 1,
      min_cadence_minutes: 10080,
      current_task_count: 1,
      billingUrl: PLAN_BILLING_URL,
    });
  });

  it("names the cadence in the min_cadence message for each plan", () => {
    expect(
      buildPlanLimitBody({ plan: "free", limit: "min_cadence", currentTaskCount: 0 }).message,
    ).toBe("Free runs tasks weekly at most. Starter runs daily, Pro runs hourly.");
    expect(
      buildPlanLimitBody({ plan: "starter", limit: "min_cadence", currentTaskCount: 2 }),
    ).toMatchObject({
      message: "Starter runs tasks daily at most. Pro runs hourly.",
      task_limit: 3,
      min_cadence_minutes: 1440,
    });
    expect(
      buildPlanLimitBody({ plan: "pro", limit: "min_cadence", currentTaskCount: 9 }),
    ).toMatchObject({
      message: "Pro runs tasks hourly at most.",
      task_limit: null,
      min_cadence_minutes: 60,
    });
  });

  it("starter task_count message points at Pro", () => {
    expect(
      buildPlanLimitBody({ plan: "starter", limit: "task_count", currentTaskCount: 3 }).message,
    ).toBe("Starter includes 3 tasks. Pro is unlimited.");
  });

  it("points billingUrl at /plan, not the app root", () => {
    expect(PLAN_BILLING_URL).toBe("https://app.recoupable.dev/plan");
    expect(
      buildPlanLimitBody({ plan: "free", limit: "task_count", currentTaskCount: 1 }).billingUrl,
    ).toBe("https://app.recoupable.dev/plan");
  });
});
