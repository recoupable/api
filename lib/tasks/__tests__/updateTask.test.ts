import { describe, it, expect, vi, beforeEach } from "vitest";

import { updateTask } from "../updateTask";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { updateScheduledAction } from "@/lib/supabase/scheduled_actions/updateScheduledAction";
import { syncTriggerSchedule } from "@/lib/trigger/syncTriggerSchedule";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: vi.fn(),
}));
vi.mock("@/lib/supabase/scheduled_actions/updateScheduledAction", () => ({
  updateScheduledAction: vi.fn(),
}));
vi.mock("@/lib/trigger/syncTriggerSchedule", () => ({ syncTriggerSchedule: vi.fn() }));
vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: vi.fn(
    async ({ currentAccountId, targetAccountId }) => currentAccountId === targetAccountId,
  ),
}));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const taskId = "11111111-2222-4333-8444-555555555555";
const existingTask = {
  id: taskId,
  account_id: accountId,
  schedule: "0 9 * * 1",
  enabled: true,
  trigger_schedule_id: "sched-1",
};

const STRANGER = "33333333-3333-4333-8333-333333333333";
const ADMIN = "44444444-4444-4444-8444-444444444444";

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

  it("denies a caller who cannot access the task's account", async () => {
    await expect(
      updateTask({ id: taskId, title: "x", resolvedAccountId: STRANGER }),
    ).rejects.toThrow("Access denied to this task");
    expect(canAccessAccount).toHaveBeenCalledWith({
      currentAccountId: STRANGER,
      targetAccountId: existingTask.account_id,
    });
    expect(updateScheduledAction).not.toHaveBeenCalled();
  });

  it("updates another account's task when the caller can access that account — no body account_id needed (app#2016)", async () => {
    vi.mocked(canAccessAccount).mockResolvedValueOnce(true);
    await updateTask({ id: taskId, title: "x", resolvedAccountId: ADMIN });
    expect(updateScheduledAction).toHaveBeenCalled();
  });
});
