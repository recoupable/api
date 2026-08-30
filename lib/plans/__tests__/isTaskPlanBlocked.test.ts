import { describe, expect, it } from "vitest";
import { isTaskPlanBlocked } from "@/lib/plans/isTaskPlanBlocked";

const task = (id: string, schedule: string, created_at: string, enabled = true) =>
  ({ id, schedule, created_at, enabled, account_id: "acc" }) as never;

const OLD = "2026-06-01T00:00:00.000Z";
const NEW = "2026-09-15T00:00:00.000Z";

describe("isTaskPlanBlocked", () => {
  it("blocks a pre-existing task that is outside the plan, with no grandfather window", () => {
    const t = task("t1", "0 9 * * *", OLD);
    expect(isTaskPlanBlocked({ task: t, plan: "free", enabledTasks: [t] })).toBe("min_cadence");
  });

  it("a denser cadence is checked immediately (downgrade case)", () => {
    const t = task("t1", "0 * * * *", NEW);
    expect(isTaskPlanBlocked({ task: t, plan: "free", enabledTasks: [t] })).toBe("min_cadence");
    expect(isTaskPlanBlocked({ task: t, plan: "pro", enabledTasks: [t] })).toBeNull();
  });

  it("over the cap, the oldest tasks keep their slots and the newest are blocked", () => {
    const a = task("a", "0 9 * * 1", NEW);
    const b = task("b", "0 9 * * 1", "2026-09-16T00:00:00.000Z");
    expect(isTaskPlanBlocked({ task: a, plan: "free", enabledTasks: [b, a] })).toBeNull();
    expect(isTaskPlanBlocked({ task: b, plan: "free", enabledTasks: [b, a] })).toBe("task_count");
  });

  it("a disabled task is never reported", () => {
    const t = task("t1", "* * * * *", NEW, false);
    expect(isTaskPlanBlocked({ task: t, plan: "free", enabledTasks: [] })).toBeNull();
  });
});
