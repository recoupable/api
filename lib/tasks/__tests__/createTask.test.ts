import { describe, it, expect, vi, beforeEach } from "vitest";

import { createTask } from "../createTask";
import { insertScheduledAction } from "@/lib/supabase/scheduled_actions/insertScheduledAction";
import { updateScheduledAction } from "@/lib/supabase/scheduled_actions/updateScheduledAction";
import { createSchedule } from "@/lib/trigger/createSchedule";

vi.mock("@/lib/supabase/scheduled_actions/insertScheduledAction", () => ({
  insertScheduledAction: vi.fn(),
}));
vi.mock("@/lib/supabase/scheduled_actions/updateScheduledAction", () => ({
  updateScheduledAction: vi.fn(),
}));
vi.mock("@/lib/trigger/createSchedule", () => ({ createSchedule: vi.fn() }));

const baseInput = {
  title: "Weekly report",
  prompt: "Summarize the catalog",
  schedule: "0 9 * * 1",
  artist_account_id: "artist-1",
  account_id: "acc-1",
};

describe("createTask (timezone)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(insertScheduledAction).mockResolvedValue([{ id: "task-1" }] as never);
    vi.mocked(createSchedule).mockResolvedValue({ id: "sched-1" } as never);
    vi.mocked(updateScheduledAction).mockResolvedValue({ id: "task-1" } as never);
  });

  it("passes the timezone to the Trigger.dev schedule", async () => {
    await createTask({ ...baseInput, timezone: "America/New_York" });

    expect(createSchedule).toHaveBeenCalledWith({
      cron: "0 9 * * 1",
      deduplicationKey: "task-1",
      externalId: "task-1",
      timezone: "America/New_York",
    });
  });

  it("does NOT persist the timezone on scheduled_actions (Trigger.dev is the source of truth)", async () => {
    await createTask({ ...baseInput, timezone: "America/New_York" });

    const insertArg = vi.mocked(insertScheduledAction).mock.calls[0][0];
    expect(insertArg).not.toHaveProperty("timezone");
    expect(insertArg).toMatchObject({ schedule: "0 9 * * 1", title: "Weekly report" });
  });

  it("omits timezone on the schedule when none is supplied (defaults to UTC in createSchedule)", async () => {
    await createTask({ ...baseInput });

    expect(createSchedule).toHaveBeenCalledWith({
      cron: "0 9 * * 1",
      deduplicationKey: "task-1",
      externalId: "task-1",
      timezone: undefined,
    });
  });
});
