import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateTask } from "@/lib/tasks/updateTask";
import { assertTaskWithinPlan } from "@/lib/plans/assertTaskWithinPlan";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { updateScheduledAction } from "@/lib/supabase/scheduled_actions/updateScheduledAction";
import { syncTriggerSchedule } from "@/lib/trigger/syncTriggerSchedule";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

vi.mock("@/lib/plans/assertTaskWithinPlan", () => ({ assertTaskWithinPlan: vi.fn() }));
vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: vi.fn(),
}));
vi.mock("@/lib/supabase/scheduled_actions/updateScheduledAction", () => ({
  updateScheduledAction: vi.fn(),
}));
vi.mock("@/lib/trigger/syncTriggerSchedule", () => ({ syncTriggerSchedule: vi.fn() }));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));

const ID = "123e4567-e89b-12d3-a456-426614174000";
const OWNER = "123e4567-e89b-12d3-a456-426614174001";
const existing = {
  id: ID,
  account_id: OWNER,
  schedule: "0 9 * * 1",
  enabled: false,
  trigger_schedule_id: "s",
};

describe("updateTask plan gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(selectScheduledActions).mockResolvedValue([existing] as never);
    vi.mocked(canAccessAccount).mockResolvedValue(true);
    vi.mocked(syncTriggerSchedule).mockResolvedValue("s");
    vi.mocked(updateScheduledAction).mockResolvedValue(existing as never);
  });

  it("a title-only edit never consults the plan", async () => {
    await updateTask({ id: ID, title: "new", resolvedAccountId: OWNER });
    expect(assertTaskWithinPlan).not.toHaveBeenCalled();
  });

  it("enabling a disabled task counts toward the owner's limit, excluding itself", async () => {
    await updateTask({ id: ID, enabled: true, resolvedAccountId: OWNER });
    expect(assertTaskWithinPlan).toHaveBeenCalledWith({
      accountId: OWNER,
      schedule: undefined,
      countsTowardLimit: true,
      excludeTaskId: ID,
    });
  });

  it("a schedule change checks cadence without counting the task again", async () => {
    vi.mocked(selectScheduledActions).mockResolvedValue([{ ...existing, enabled: true }] as never);
    await updateTask({ id: ID, schedule: "0 9 * * *", resolvedAccountId: OWNER });
    expect(assertTaskWithinPlan).toHaveBeenCalledWith({
      accountId: OWNER,
      schedule: "0 9 * * *",
      countsTowardLimit: false,
      excludeTaskId: ID,
    });
  });

  it("writes nothing when the gate throws", async () => {
    vi.mocked(assertTaskWithinPlan).mockRejectedValue(new Error("blocked"));
    await expect(updateTask({ id: ID, enabled: true, resolvedAccountId: OWNER })).rejects.toThrow(
      "blocked",
    );
    expect(syncTriggerSchedule).not.toHaveBeenCalled();
    expect(updateScheduledAction).not.toHaveBeenCalled();
  });
});
