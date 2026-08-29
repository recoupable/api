import { describe, expect, it } from "vitest";
import { isTaskPlanBlocked } from "@/lib/plans/isTaskPlanBlocked";
import { TASK_GATE_GRANDFATHER_UNTIL, TASK_GATE_LAUNCHED_AT } from "@/lib/plans/const";

const task = (id: string, schedule: string, created_at: string, enabled = true) =>
  ({ id, schedule, created_at, enabled, account_id: "acc" }) as never;

const OLD = "2026-06-01T00:00:00.000Z";
const NEW = "2026-09-15T00:00:00.000Z";
const beforeCutoff = new Date(new Date(TASK_GATE_GRANDFATHER_UNTIL).getTime() - 1);
const afterCutoff = new Date(new Date(TASK_GATE_GRANDFATHER_UNTIL).getTime() + 1);

describe("isTaskPlanBlocked", () => {
  it("a task that predates the gate runs until the grandfather date, then is blocked", () => {
    const t = task("t1", "0 9 * * *", OLD);
    expect(new Date(OLD) < new Date(TASK_GATE_LAUNCHED_AT)).toBe(true);
    expect(
      isTaskPlanBlocked({ task: t, plan: "free", enabledTasks: [t], now: beforeCutoff }),
    ).toBeNull();
    expect(isTaskPlanBlocked({ task: t, plan: "free", enabledTasks: [t], now: afterCutoff })).toBe(
      "min_cadence",
    );
  });

  it("a task created after the gate is checked immediately (downgrade case)", () => {
    const t = task("t1", "0 * * * *", NEW);
    expect(isTaskPlanBlocked({ task: t, plan: "free", enabledTasks: [t], now: beforeCutoff })).toBe(
      "min_cadence",
    );
    expect(
      isTaskPlanBlocked({ task: t, plan: "pro", enabledTasks: [t], now: beforeCutoff }),
    ).toBeNull();
  });

  it("over the cap, the oldest tasks keep their slots and the newest are blocked", () => {
    const a = task("a", "0 9 * * 1", NEW);
    const b = task("b", "0 9 * * 1", "2026-09-16T00:00:00.000Z");
    expect(
      isTaskPlanBlocked({ task: a, plan: "free", enabledTasks: [b, a], now: beforeCutoff }),
    ).toBeNull();
    expect(
      isTaskPlanBlocked({ task: b, plan: "free", enabledTasks: [b, a], now: beforeCutoff }),
    ).toBe("task_count");
  });

  it("a disabled task is never reported", () => {
    const t = task("t1", "* * * * *", NEW, false);
    expect(
      isTaskPlanBlocked({ task: t, plan: "free", enabledTasks: [], now: afterCutoff }),
    ).toBeNull();
  });
});
