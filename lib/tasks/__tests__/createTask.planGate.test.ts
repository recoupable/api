import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTask } from "@/lib/tasks/createTask";
import { assertTaskWithinPlan } from "@/lib/plans/assertTaskWithinPlan";
import { insertScheduledAction } from "@/lib/supabase/scheduled_actions/insertScheduledAction";

vi.mock("@/lib/plans/assertTaskWithinPlan", () => ({ assertTaskWithinPlan: vi.fn() }));
vi.mock("@/lib/supabase/scheduled_actions/insertScheduledAction", () => ({
  insertScheduledAction: vi.fn(),
}));
vi.mock("@/lib/supabase/scheduled_actions/updateScheduledAction", () => ({
  updateScheduledAction: vi.fn(),
}));
vi.mock("@/lib/trigger/createSchedule", () => ({ createSchedule: vi.fn() }));

const input = {
  title: "t",
  prompt: "p",
  schedule: "0 9 * * *",
  artist_account_id: "123e4567-e89b-12d3-a456-426614174000",
  account_id: "123e4567-e89b-12d3-a456-426614174001",
};

describe("createTask plan gate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("checks the owner's plan with the schedule before inserting, and inserts nothing when it throws", async () => {
    vi.mocked(assertTaskWithinPlan).mockRejectedValue(new Error("blocked"));
    await expect(createTask(input)).rejects.toThrow("blocked");
    expect(assertTaskWithinPlan).toHaveBeenCalledWith({
      accountId: input.account_id,
      schedule: "0 9 * * *",
    });
    expect(insertScheduledAction).not.toHaveBeenCalled();
  });
});
