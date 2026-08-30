import { describe, expect, it } from "vitest";
import { findTaskPlanViolation } from "@/lib/plans/findTaskPlanViolation";

describe("findTaskPlanViolation", () => {
  it("free with 0 tasks and a weekly cron passes", () => {
    expect(
      findTaskPlanViolation({ plan: "free", enabledTaskCount: 0, schedule: "0 9 * * 1" }),
    ).toBeNull();
  });

  it("free with 1 enabled task hits task_count before cadence", () => {
    expect(
      findTaskPlanViolation({ plan: "free", enabledTaskCount: 1, schedule: "0 9 * * *" }),
    ).toBe("task_count");
  });

  it("free with a daily cron hits min_cadence", () => {
    expect(
      findTaskPlanViolation({ plan: "free", enabledTaskCount: 0, schedule: "0 9 * * *" }),
    ).toBe("min_cadence");
  });

  it("starter allows 3 daily tasks, blocks the 4th and hourly", () => {
    expect(
      findTaskPlanViolation({ plan: "starter", enabledTaskCount: 2, schedule: "0 9 * * *" }),
    ).toBeNull();
    expect(
      findTaskPlanViolation({ plan: "starter", enabledTaskCount: 3, schedule: "0 9 * * *" }),
    ).toBe("task_count");
    expect(
      findTaskPlanViolation({ plan: "starter", enabledTaskCount: 0, schedule: "0 * * * *" }),
    ).toBe("min_cadence");
  });

  it("pro is uncapped and allows hourly but not every 30 minutes", () => {
    expect(
      findTaskPlanViolation({ plan: "pro", enabledTaskCount: 50, schedule: "0 * * * *" }),
    ).toBeNull();
    expect(
      findTaskPlanViolation({ plan: "pro", enabledTaskCount: 0, schedule: "*/30 * * * *" }),
    ).toBe("min_cadence");
  });

  it("skips the count check when countsTowardLimit is false, and cadence when no schedule is given", () => {
    expect(
      findTaskPlanViolation({
        plan: "free",
        enabledTaskCount: 5,
        schedule: "0 9 * * 1",
        countsTowardLimit: false,
      }),
    ).toBeNull();
    expect(findTaskPlanViolation({ plan: "free", enabledTaskCount: 0 })).toBeNull();
  });

  it("an unparseable cron is not a cadence violation (other validation owns it)", () => {
    expect(
      findTaskPlanViolation({ plan: "free", enabledTaskCount: 0, schedule: "nope" }),
    ).toBeNull();
  });
});
