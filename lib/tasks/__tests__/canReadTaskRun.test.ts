import { beforeEach, describe, expect, it, vi } from "vitest";
import { canReadTaskRun } from "../canReadTaskRun";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: vi.fn(),
}));
beforeEach(() => vi.resetAllMocks());
describe("canReadTaskRun", () => {
  it.each([{ accountId: "owner" }, { account_id: "owner" }])(
    "accepts server-issued payload ownership %j",
    async payload => {
      expect(await canReadTaskRun({ payload }, "owner")).toBe(true);
    },
  );
  it.each([
    { payload: { accountId: "other" }, tags: ["account:owner"] },
    { payload: { accountId: "owner", account_id: "other" } },
    { tags: ["account:owner", "account:other"] },
    { payload: { accountId: 123 }, tags: ["account:owner"] },
    {},
  ])("denies foreign, contradictory or missing ownership %j", async job => {
    expect(await canReadTaskRun(job, "owner")).toBe(false);
  });
  it("accepts an unambiguous worker-issued account tag for legacy runs", async () => {
    expect(await canReadTaskRun({ tags: ["other-tag", "account:owner"] }, "owner")).toBe(true);
  });
  it("checks a scheduled run against the saved task owner", async () => {
    vi.mocked(selectScheduledActions).mockResolvedValue([
      {
        id: "task",
        account_id: "owner",
        artist_account_id: null,
        created_at: "2026-10-14",
        enabled: true,
        model: null,
        prompt: "brief",
        schedule: "0 9 * * *",
        title: "brief",
        trigger_schedule_id: "schedule",
        updated_at: "2026-10-14",
      },
    ]);
    expect(await canReadTaskRun({ payload: { externalId: "task" } }, "owner")).toBe(true);
    expect(selectScheduledActions).toHaveBeenCalledWith({ id: "task", account_id: "owner" });
  });
  it("does not substitute a matching tag for a missing scheduled task", async () => {
    vi.mocked(selectScheduledActions).mockResolvedValue([]);
    expect(
      await canReadTaskRun({ payload: { externalId: "task" }, tags: ["account:owner"] }, "owner"),
    ).toBe(false);
  });
});
