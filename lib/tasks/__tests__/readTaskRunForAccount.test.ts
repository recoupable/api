import { beforeEach, describe, expect, it, vi } from "vitest";
import { readTaskRunForAccount } from "../readTaskRunForAccount";
import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";

vi.mock("@/lib/trigger/retrieveTaskRun", () => ({ retrieveTaskRun: vi.fn() }));
vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: vi.fn(),
}));

const run = { id: "run_1", status: "COMPLETED", output: { private: "account output" } };
const read = () => readTaskRunForAccount({ runId: "run_1", accountId: "owner" });
const providerRun = (ownership: Record<string, unknown>) =>
  ({ ...run, ...ownership }) as NonNullable<Awaited<ReturnType<typeof retrieveTaskRun>>>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(selectScheduledActions).mockResolvedValue([]);
});

describe("readTaskRunForAccount", () => {
  it.each([
    { payload: { accountId: "owner" } },
    { payload: { account_id: "owner" } },
    { tags: ["worker", "account:owner"] },
  ])("returns the unmodified owned run: %j", async ownership => {
    const job = providerRun(ownership);
    vi.mocked(retrieveTaskRun).mockResolvedValue(job);
    expect(await read()).toBe(job);
    expect(retrieveTaskRun).toHaveBeenCalledExactlyOnceWith("run_1");
  });

  it.each([
    { payload: { accountId: "other" } },
    {},
    { payload: { accountId: "other" }, tags: ["account:owner"] },
    { payload: { accountId: "owner", account_id: "other" } },
    { tags: ["account:owner", "account:other"] },
    { payload: { externalId: "one" }, schedule: { externalId: "two" } },
    { payload: { externalId: "missing" }, tags: ["account:owner"] },
  ])("does not return foreign, unattributed, or conflicting runs: %j", async ownership => {
    vi.mocked(retrieveTaskRun).mockResolvedValue(providerRun(ownership));
    expect(await read()).toBeNull();
  });

  it("returns null for a missing run without a scheduled-task lookup", async () => {
    vi.mocked(retrieveTaskRun).mockResolvedValue(null);
    expect(await read()).toBeNull();
    expect(selectScheduledActions).not.toHaveBeenCalled();
  });

  it.each(["owner", "other"])("checks persisted scheduled ownership for %s", async owner => {
    const job = providerRun({ schedule: { externalId: "task_1" } });
    vi.mocked(retrieveTaskRun).mockResolvedValue(job);
    vi.mocked(selectScheduledActions).mockResolvedValue([
      { id: "task_1", account_id: owner } as Awaited<ReturnType<typeof selectScheduledActions>>[0],
    ]);
    expect(await read()).toBe(owner === "owner" ? job : null);
    expect(selectScheduledActions).toHaveBeenCalledExactlyOnceWith({
      id: "task_1",
      account_id: "owner",
    });
  });

  it("preserves case-insensitive UUID ownership", async () => {
    const accountId = "abcdefab-1234-4567-89ab-abcdefabcdef";
    const job = providerRun({ payload: { accountId: accountId.toUpperCase() } });
    vi.mocked(retrieveTaskRun).mockResolvedValue(job);
    expect(await readTaskRunForAccount({ runId: "run_1", accountId })).toBe(job);
  });

  it("propagates provider errors for transport-specific error handling", async () => {
    const error = new Error("provider unavailable");
    vi.mocked(retrieveTaskRun).mockRejectedValue(error);
    await expect(read()).rejects.toBe(error);
  });

  it("propagates ownership lookup failures without returning the run", async () => {
    vi.mocked(retrieveTaskRun).mockResolvedValue(providerRun({ schedule: { externalId: "task" } }));
    const error = new Error("ownership lookup unavailable");
    vi.mocked(selectScheduledActions).mockRejectedValue(error);
    await expect(read()).rejects.toBe(error);
  });
});
