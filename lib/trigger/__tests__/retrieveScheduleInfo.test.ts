import { describe, it, expect, vi, beforeEach } from "vitest";
import { schedules } from "@trigger.dev/sdk";
import { retrieveScheduleInfo } from "@/lib/trigger/retrieveScheduleInfo";

vi.mock("@trigger.dev/sdk", () => ({ schedules: { retrieve: vi.fn() } }));

describe("retrieveScheduleInfo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the schedule's timezone and next fire time as an ISO string", async () => {
    vi.mocked(schedules.retrieve).mockResolvedValue({
      timezone: "America/Bogota",
      nextRun: new Date("2026-08-31T14:00:00.000Z"),
    } as never);
    await expect(retrieveScheduleInfo("sched_abc")).resolves.toEqual({
      timezone: "America/Bogota",
      nextRun: "2026-08-31T14:00:00.000Z",
    });
  });

  it("leaves nextRun undefined when the schedule has none", async () => {
    vi.mocked(schedules.retrieve).mockResolvedValue({ timezone: "UTC", nextRun: null } as never);
    await expect(retrieveScheduleInfo("sched_abc")).resolves.toEqual({
      timezone: "UTC",
      nextRun: undefined,
    });
  });

  it("returns an empty object (never throws) when the schedule cannot be read", async () => {
    vi.mocked(schedules.retrieve).mockRejectedValue(new Error("boom"));
    await expect(retrieveScheduleInfo("sched_missing")).resolves.toEqual({});
  });
});
