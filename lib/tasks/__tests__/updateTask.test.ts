import { describe, it, expect, vi, beforeEach } from "vitest";

import { updateTask } from "../updateTask";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { updateScheduledAction } from "@/lib/supabase/scheduled_actions/updateScheduledAction";
import { syncTriggerSchedule } from "@/lib/trigger/syncTriggerSchedule";

vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: vi.fn(),
}));
vi.mock("@/lib/supabase/scheduled_actions/updateScheduledAction", () => ({
  updateScheduledAction: vi.fn(),
}));
vi.mock("@/lib/trigger/syncTriggerSchedule", () => ({ syncTriggerSchedule: vi.fn() }));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const taskId = "11111111-2222-4333-8444-555555555555";
const existingTask = {
  id: taskId,
  account_id: accountId,
  schedule: "0 9 * * 1",
  enabled: true,
  trigger_schedule_id: "sched-1",
};

describe("updateTask (timezone)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(selectScheduledActions).mockResolvedValue([existingTask] as never);
    vi.mocked(syncTriggerSchedule).mockResolvedValue("sched-1");
    vi.mocked(updateScheduledAction).mockResolvedValue(existingTask as never);
  });

  it("passes the timezone to syncTriggerSchedule and treats a tz-only change as a schedule change", async () => {
    await updateTask({
      id: taskId,
      timezone: "America/New_York",
      resolvedAccountId: accountId,
    } as never);

    expect(syncTriggerSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId,
        cronExpression: "0 9 * * 1", // falls back to existing cron
        scheduleChanged: true,
        timezone: "America/New_York",
      }),
    );
  });

  it("does NOT write to scheduled_actions on a timezone-only update (empty update would error)", async () => {
    const result = await updateTask({
      id: taskId,
      timezone: "America/New_York",
      resolvedAccountId: accountId,
    } as never);

    expect(updateScheduledAction).not.toHaveBeenCalled();
    expect(result).toEqual(existingTask);
  });

  it("still persists real column changes (e.g. title)", async () => {
    await updateTask({
      id: taskId,
      title: "New title",
      resolvedAccountId: accountId,
    } as never);

    expect(updateScheduledAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: taskId, title: "New title" }),
    );
  });
});
