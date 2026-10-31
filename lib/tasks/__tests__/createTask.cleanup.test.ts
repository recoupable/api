import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTask } from "../createTask";
import { insertScheduledAction } from "@/lib/supabase/scheduled_actions/insertScheduledAction";
import { updateScheduledAction } from "@/lib/supabase/scheduled_actions/updateScheduledAction";
import { deleteScheduledAction } from "@/lib/supabase/scheduled_actions/deleteScheduledAction";
import { createSchedule } from "@/lib/trigger/createSchedule";
import { assertTaskWithinPlan } from "@/lib/plans/assertTaskWithinPlan";

vi.mock("@/lib/supabase/scheduled_actions/insertScheduledAction", () => ({
  insertScheduledAction: vi.fn(),
}));
vi.mock("@/lib/supabase/scheduled_actions/updateScheduledAction", () => ({
  updateScheduledAction: vi.fn(),
}));
vi.mock("@/lib/supabase/scheduled_actions/deleteScheduledAction", () => ({
  deleteScheduledAction: vi.fn(),
}));
vi.mock("@/lib/trigger/createSchedule", () => ({ createSchedule: vi.fn() }));
vi.mock("@/lib/plans/assertTaskWithinPlan", () => ({ assertTaskWithinPlan: vi.fn() }));

const input = {
  title: "Weekly report",
  prompt: "Summarize growth",
  schedule: "0 9 * * 1",
  artist_account_id: "fixture-creator",
  account_id: "fixture-account",
  timezone: "America/New_York",
};
const task = { id: "new-task", account_id: input.account_id };

describe("createTask failure cleanup", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(insertScheduledAction).mockResolvedValue([task] as never);
    vi.mocked(updateScheduledAction).mockResolvedValue({
      ...task,
      trigger_schedule_id: "schedule-id",
    } as never);
    vi.mocked(createSchedule).mockResolvedValue({ id: "schedule-id" } as never);
  });
  afterEach(() => vi.restoreAllMocks());

  it("keeps successful creation, timezone and returned schedule association unchanged", async () => {
    expect(await createTask(input)).toEqual({ ...task, trigger_schedule_id: "schedule-id" });
    expect(createSchedule).toHaveBeenCalledWith({
      cron: input.schedule,
      deduplicationKey: task.id,
      externalId: task.id,
      timezone: input.timezone,
    });
    expect(deleteScheduledAction).not.toHaveBeenCalled();
  });

  it("removes only the newly inserted row on scheduler rejection and preserves the original error", async () => {
    const failure = new Error("Scheduler unavailable");
    vi.mocked(createSchedule).mockRejectedValue(failure);
    await expect(createTask(input)).rejects.toBe(failure);
    expect(deleteScheduledAction).toHaveBeenCalledExactlyOnceWith(task.id);
    expect(updateScheduledAction).not.toHaveBeenCalled();
  });

  it("also preserves a non-Error scheduler rejection after cleanup", async () => {
    vi.mocked(createSchedule).mockRejectedValue("scheduler unavailable");
    await expect(createTask(input)).rejects.toBe("scheduler unavailable");
    expect(deleteScheduledAction).toHaveBeenCalledExactlyOnceWith(task.id);
  });

  it("cleans up when the scheduler returns no usable ID and retains the existing error message", async () => {
    vi.mocked(createSchedule).mockResolvedValue({ id: "" } as never);
    await expect(createTask(input)).rejects.toThrow(
      "Failed to create Trigger.dev schedule: missing schedule id",
    );
    expect(deleteScheduledAction).toHaveBeenCalledExactlyOnceWith(task.id);
    expect(updateScheduledAction).not.toHaveBeenCalled();
  });

  it("does not mask the scheduler error when cleanup also fails", async () => {
    const failure = new Error("Scheduler unavailable");
    const cleanupFailure = new Error("Delete unavailable");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(createSchedule).mockRejectedValue(failure);
    vi.mocked(deleteScheduledAction).mockRejectedValue(cleanupFailure);
    await expect(createTask(input)).rejects.toBe(failure);
    expect(log).toHaveBeenCalledWith(
      "Failed to clean up task after scheduler failure:",
      task.id,
      cleanupFailure,
    );
  });

  it("does not delete anything if the initial insert fails", async () => {
    const failure = new Error("Insert unavailable");
    vi.mocked(insertScheduledAction).mockRejectedValue(failure);
    await expect(createTask(input)).rejects.toBe(failure);
    expect(deleteScheduledAction).not.toHaveBeenCalled();
    expect(createSchedule).not.toHaveBeenCalled();
  });

  it("does not attempt cleanup without a newly inserted task ID", async () => {
    vi.mocked(insertScheduledAction).mockResolvedValue([]);
    await expect(createTask(input)).rejects.toThrow(
      "Failed to create task: missing Supabase id for scheduling",
    );
    expect(deleteScheduledAction).not.toHaveBeenCalled();
    expect(createSchedule).not.toHaveBeenCalled();
  });

  it("does not widen cleanup to association-write failures after a schedule ID was returned", async () => {
    const failure = new Error("Association write unavailable");
    vi.mocked(updateScheduledAction).mockRejectedValue(failure);
    await expect(createTask(input)).rejects.toBe(failure);
    expect(deleteScheduledAction).not.toHaveBeenCalled();
  });

  it("keeps plan rejection before insertion and cleanup", async () => {
    const failure = new Error("Plan blocked");
    vi.mocked(assertTaskWithinPlan).mockRejectedValue(failure);
    await expect(createTask(input)).rejects.toBe(failure);
    expect(insertScheduledAction).not.toHaveBeenCalled();
    expect(deleteScheduledAction).not.toHaveBeenCalled();
    expect(createSchedule).not.toHaveBeenCalled();
  });
});
