import { describe, it, expect, vi, beforeEach } from "vitest";
import { enrichTasks } from "../enrichTasks";
import { fetchTriggerRuns } from "@/lib/trigger/fetchTriggerRuns";
import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";
import { retrieveScheduleInfo } from "@/lib/trigger/retrieveScheduleInfo";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

vi.mock("@/lib/trigger/fetchTriggerRuns", () => ({
  fetchTriggerRuns: vi.fn(),
}));

vi.mock("@/lib/trigger/retrieveTaskRun", () => ({
  retrieveTaskRun: vi.fn(),
}));

vi.mock("@/lib/trigger/retrieveScheduleInfo", () => ({
  retrieveScheduleInfo: vi.fn(),
}));

vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({
  selectAccounts: vi.fn(async () => [{ id: "artist-789", name: "Braden Bales" }]),
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
    vi.mocked(retrieveScheduleInfo).mockResolvedValue({});
  });

  it("returns recent_runs, upcoming, owner_email, and the schedule's timezone", async () => {
    vi.mocked(fetchTriggerRuns).mockResolvedValue([mockRun] as never);
    vi.mocked(retrieveScheduleInfo).mockResolvedValue({ timezone: "America/New_York" });
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
        artist_name: "Braden Bales",
        timezone: "America/New_York",
      },
    ]);
    expect(fetchTriggerRuns).toHaveBeenCalledWith({ "filter[schedule]": "sched_abc" }, 5);
    expect(retrieveScheduleInfo).toHaveBeenCalledWith("sched_abc");
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
        artist_name: "Braden Bales",
        timezone: null,
      },
    ]);
    expect(fetchTriggerRuns).not.toHaveBeenCalled();
    expect(retrieveScheduleInfo).not.toHaveBeenCalled();
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
        artist_name: "Braden Bales",
        timezone: null,
      },
    ]);
  });

  it("returns empty upcoming but still the timezone when no runs exist", async () => {
    vi.mocked(fetchTriggerRuns).mockResolvedValue([] as never);
    vi.mocked(retrieveScheduleInfo).mockResolvedValue({ timezone: "UTC" });
    vi.mocked(selectAccountEmails).mockResolvedValue([]);

    const result = await enrichTasks([mockTask]);

    expect(result).toEqual([
      {
        ...mockTask,
        recent_runs: [],
        upcoming: [],
        owner_email: null,
        artist_name: "Braden Bales",
        timezone: "UTC",
      },
    ]);
    expect(retrieveTaskRun).not.toHaveBeenCalled();
  });

  it("labels the task with its artist's display name (chat#2006 item 6)", async () => {
    vi.mocked(fetchTriggerRuns).mockResolvedValue([]);
    const [task] = await enrichTasks([mockTask]);
    expect(selectAccounts).toHaveBeenCalledWith(["artist-789"]);
    expect(task.artist_name).toBe("Braden Bales");
  });

  it("nulls artist_name when the artist account no longer exists", async () => {
    vi.mocked(fetchTriggerRuns).mockResolvedValue([]);
    vi.mocked(selectAccounts).mockResolvedValueOnce([]);
    const [task] = await enrichTasks([mockTask]);
    expect(task.artist_name).toBeNull();
  });

  it("falls back to the schedule's next fire time for upcoming when the task has never run", async () => {
    vi.mocked(fetchTriggerRuns).mockResolvedValue([]);
    vi.mocked(retrieveScheduleInfo).mockResolvedValue({
      timezone: "UTC",
      nextRun: "2026-08-31T14:00:00.000Z",
    });
    const [task] = await enrichTasks([mockTask]);
    expect(task.upcoming).toEqual(["2026-08-31T14:00:00.000Z"]);
  });

  it("keeps the run payload's upcoming over the schedule fallback when a run exists", async () => {
    vi.mocked(fetchTriggerRuns).mockResolvedValue([mockRun] as never);
    vi.mocked(retrieveScheduleInfo).mockResolvedValue({ nextRun: "2026-09-07T14:00:00.000Z" });
    vi.mocked(retrieveTaskRun).mockResolvedValue({
      ...mockRun,
      payload: { upcoming: ["2026-08-31T14:00:00.000Z"] },
    } as never);
    const [task] = await enrichTasks([mockTask]);
    expect(task.upcoming).toEqual(["2026-08-31T14:00:00.000Z"]);
  });
});
