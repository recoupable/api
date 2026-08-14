import { describe, it, expect, vi, beforeEach } from "vitest";

import { syncTriggerSchedule } from "../syncTriggerSchedule";
import { createSchedule } from "../createSchedule";
import { updateSchedule } from "../updateSchedule";
import { deleteSchedule } from "../deleteSchedule";
import { retrieveScheduleTimezone } from "../retrieveScheduleTimezone";

vi.mock("../createSchedule", () => ({ createSchedule: vi.fn() }));
vi.mock("../updateSchedule", () => ({ updateSchedule: vi.fn() }));
vi.mock("../deleteSchedule", () => ({ deleteSchedule: vi.fn() }));
vi.mock("../retrieveScheduleTimezone", () => ({ retrieveScheduleTimezone: vi.fn() }));

const taskId = "task-1";
const cron = "0 9 * * 1";

describe("syncTriggerSchedule (timezone)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSchedule).mockResolvedValue({ id: "sched-new" } as never);
  });

  it("passes the timezone through when creating a schedule", async () => {
    const result = await syncTriggerSchedule({
      taskId,
      enabled: true,
      cronExpression: cron,
      scheduleChanged: false,
      existingScheduleId: null,
      timezone: "America/New_York",
    });

    expect(createSchedule).toHaveBeenCalledWith({
      cron,
      deduplicationKey: taskId,
      externalId: taskId,
      timezone: "America/New_York",
    });
    expect(result).toBe("sched-new");
  });

  it("applies the provided timezone when updating a schedule", async () => {
    await syncTriggerSchedule({
      taskId,
      enabled: true,
      cronExpression: cron,
      scheduleChanged: true,
      existingScheduleId: "sched-1",
      timezone: "Europe/London",
    });

    expect(updateSchedule).toHaveBeenCalledWith({
      scheduleId: "sched-1",
      cron,
      externalId: taskId,
      timezone: "Europe/London",
    });
    expect(retrieveScheduleTimezone).not.toHaveBeenCalled();
  });

  it("preserves the existing timezone on a cron-only update (reads it back from Trigger.dev)", async () => {
    vi.mocked(retrieveScheduleTimezone).mockResolvedValue("Asia/Tokyo");

    await syncTriggerSchedule({
      taskId,
      enabled: true,
      cronExpression: cron,
      scheduleChanged: true,
      existingScheduleId: "sched-1",
      // no timezone provided
    });

    expect(retrieveScheduleTimezone).toHaveBeenCalledWith("sched-1");
    expect(updateSchedule).toHaveBeenCalledWith({
      scheduleId: "sched-1",
      cron,
      externalId: taskId,
      timezone: "Asia/Tokyo",
    });
  });

  it("deletes the schedule when disabled and never touches timezone", async () => {
    const result = await syncTriggerSchedule({
      taskId,
      enabled: false,
      cronExpression: cron,
      scheduleChanged: false,
      existingScheduleId: "sched-1",
      timezone: "America/New_York",
    });

    expect(deleteSchedule).toHaveBeenCalledWith("sched-1");
    expect(createSchedule).not.toHaveBeenCalled();
    expect(updateSchedule).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
