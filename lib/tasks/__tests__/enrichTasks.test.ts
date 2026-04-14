import { describe, it, expect, vi, beforeEach } from "vitest";
import { enrichTasks } from "../enrichTasks";

import { fetchTriggerRuns } from "@/lib/trigger/fetchTriggerRuns";
import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

vi.mock("@/lib/trigger/fetchTriggerRuns", () => ({
  fetchTriggerRuns: vi.fn(),
}));

vi.mock("@/lib/trigger/retrieveTaskRun", () => ({
  retrieveTaskRun: vi.fn(),
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
  });

  it("returns recent_runs, upcoming, and owner_email", async () => {
    vi.mocked(fetchTriggerRuns).mockResolvedValue([mockRun] as never);
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
      },
    ]);
    expect(fetchTriggerRuns).toHaveBeenCalledWith({ "filter[schedule]": "sched_abc" }, 5);
    expect(selectAccountEmails).toHaveBeenCalledWith({ accountIds: ["account-456"] });
  });

  it("returns empty trigger fields and null owner_email when no schedule or email exists", async () => {
    vi.mocked(selectAccountEmails).mockResolvedValue([]);

    const result = await enrichTasks([{ ...mockTask, trigger_schedule_id: null }]);

    expect(result).toEqual([
      {
        ...mockTask,
        trigger_schedule_id: null,
        recent_runs: [],
        upcoming: [],
        owner_email: null,
      },
    ]);
    expect(fetchTriggerRuns).not.toHaveBeenCalled();
  });

  it("returns empty trigger enrichment when Trigger.dev fails", async () => {
    vi.mocked(fetchTriggerRuns).mockRejectedValue(new Error("API error"));
    vi.mocked(selectAccountEmails).mockResolvedValue([]);

    const result = await enrichTasks([mockTask]);

    expect(result).toEqual([
      {
        ...mockTask,
        recent_runs: [],
        upcoming: [],
        owner_email: null,
      },
    ]);
  });

  it("returns empty upcoming when no runs exist", async () => {
    vi.mocked(fetchTriggerRuns).mockResolvedValue([] as never);
    vi.mocked(selectAccountEmails).mockResolvedValue([]);

    const result = await enrichTasks([mockTask]);

    expect(result).toEqual([
      {
        ...mockTask,
        recent_runs: [],
        upcoming: [],
        owner_email: null,
      },
    ]);
    expect(retrieveTaskRun).not.toHaveBeenCalled();
  });
});
