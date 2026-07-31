import { describe, it, expect, vi, beforeEach } from "vitest";
import { enrichTasks } from "../enrichTasks";
import { fetchTriggerRuns } from "@/lib/trigger/fetchTriggerRuns";
import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";
import { retrieveScheduleTimezone } from "@/lib/trigger/retrieveScheduleTimezone";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

vi.mock("@/lib/trigger/fetchTriggerRuns", () => ({
  fetchTriggerRuns: vi.fn(),
}));

vi.mock("@/lib/trigger/retrieveTaskRun", () => ({
  retrieveTaskRun: vi.fn(),
}));

vi.mock("@/lib/trigger/retrieveScheduleTimezone", () => ({
  retrieveScheduleTimezone: vi.fn(),
}));

vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: vi.fn(),
}));

const mockTask = {
  id: "task-123",
  title: "Test Task",
  prompt: "Do something",
  schedule: "0 9 * * *",
  account_id: "account-456",
  artist_account_id: "artist-789",
  trigger_schedule_id: "sched_abc",
  enabled: true,
  created_at: "2026-01-01T00:00:00Z",
  next_run: null,
  last_run: null,
  model: null,
  updated_at: null,
} as Parameters<typeof enrichTasks>[0][number];

const mockRun = {
  id: "run_xyz",
  status: "COMPLETED",
  createdAt: "2026-03-20T09:00:00.000Z",
  startedAt: "2026-03-20T09:00:01.000Z",
  finishedAt: "2026-03-20T09:01:00.000Z",
  durationMs: 59000,
};

describe("enrichTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(retrieveScheduleTimezone).mockResolvedValue(undefined);
  });

  it("returns recent_runs, upcoming, owner_email, and the schedule's timezone", async () => {
    vi.mocked(fetchTriggerRuns).mockResolvedValue([mockRun] as never);
    vi.mocked(retrieveScheduleTimezone).mockResolvedValue("America/New_York");
    vi.mocked(retrieveTaskRun).mockResolvedValue({
      ...mockRun,
      payload: {
        upcoming: ["2026-03-27T09:00:00Z", "2026-04-03T09:00:00Z"],
      },
    } as never);
    vi.mocked(selectAccountEmails).mockResolvedValue([
      {
        id: "email-1",
        account_id: "account-456",
        email: "owner@example.com",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);

    const result = await enrichTasks([mockTask]);

    expect(result).toEqual([
      {
        ...mockTask,
        recent_runs: [mockRun],
        upcoming: ["2026-03-27T09:00:00Z", "2026-04-03T09:00:00Z"],
        owner_email: "owner@example.com",
        timezone: "America/New_York",
        trigger_lookup_failed: false,
      },
    ]);
    expect(fetchTriggerRuns).toHaveBeenCalledWith({ "filter[schedule]": "sched_abc" }, 5);
    expect(retrieveScheduleTimezone).toHaveBeenCalledWith("sched_abc");
    expect(selectAccountEmails).toHaveBeenCalledWith({ accountIds: ["account-456"] });
  });

  it("returns empty trigger fields, null owner_email, and null timezone when no schedule exists", async () => {
    vi.mocked(selectAccountEmails).mockResolvedValue([]);

    const result = await enrichTasks([{ ...mockTask, trigger_schedule_id: null }]);

    expect(result).toEqual([
      {
        ...mockTask,
        trigger_schedule_id: null,
        recent_runs: [],
        upcoming: [],
        owner_email: null,
        timezone: null,
        trigger_lookup_failed: false,
      },
    ]);
    expect(fetchTriggerRuns).not.toHaveBeenCalled();
    expect(retrieveScheduleTimezone).not.toHaveBeenCalled();
  });

  it("returns empty enrichment (timezone null) when Trigger.dev fails", async () => {
    vi.mocked(fetchTriggerRuns).mockRejectedValue(new Error("API error"));
    vi.mocked(selectAccountEmails).mockResolvedValue([]);

    const result = await enrichTasks([mockTask]);

    expect(result).toEqual([
      {
        ...mockTask,
        recent_runs: [],
        upcoming: [],
        owner_email: null,
        timezone: null,
        trigger_lookup_failed: true,
      },
    ]);
  });

  it("returns empty upcoming but still the timezone when no runs exist", async () => {
    vi.mocked(fetchTriggerRuns).mockResolvedValue([] as never);
    vi.mocked(retrieveScheduleTimezone).mockResolvedValue("UTC");
    vi.mocked(selectAccountEmails).mockResolvedValue([]);

    const result = await enrichTasks([mockTask]);

    expect(result).toEqual([
      {
        ...mockTask,
        recent_runs: [],
        upcoming: [],
        owner_email: null,
        timezone: "UTC",
        trigger_lookup_failed: false,
      },
    ]);
    expect(retrieveTaskRun).not.toHaveBeenCalled();
  });

  it("flags trigger_lookup_failed when the Trigger lookup throws (chat#1918)", async () => {
    vi.mocked(fetchTriggerRuns).mockRejectedValue(new Error("Trigger API 503"));
    vi.mocked(retrieveScheduleTimezone).mockResolvedValue(null as never);
    vi.mocked(selectAccountEmails).mockResolvedValue([] as never);
    const [enriched] = await enrichTasks([mockTask]);
    expect(enriched.trigger_lookup_failed).toBe(true);
    expect(enriched.upcoming).toEqual([]);
  });

  it("does NOT flag a live schedule that legitimately has no runs yet", async () => {
    vi.mocked(fetchTriggerRuns).mockResolvedValue([] as never);
    vi.mocked(retrieveScheduleTimezone).mockResolvedValue("UTC" as never);
    vi.mocked(selectAccountEmails).mockResolvedValue([] as never);
    const [enriched] = await enrichTasks([mockTask]);
    expect(enriched.trigger_lookup_failed).toBe(false);
    expect(enriched.upcoming).toEqual([]);
  });

  it("does NOT flag a task that has no trigger_schedule_id to look up", async () => {
    vi.mocked(selectAccountEmails).mockResolvedValue([] as never);
    const [enriched] = await enrichTasks([{ ...mockTask, trigger_schedule_id: null }]);
    expect(enriched.trigger_lookup_failed).toBe(false);
  });
});
