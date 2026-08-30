import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getTasksHandler } from "@/lib/tasks/getTasksHandler";
import { validateGetTasksQuery } from "@/lib/tasks/validateGetTasksQuery";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { enrichTasks } from "@/lib/tasks/enrichTasks";
import { getTaskRunBlock } from "@/lib/plans/getTaskRunBlock";
import { buildPlanLimitBody } from "@/lib/plans/buildPlanLimitBody";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("@/lib/tasks/validateGetTasksQuery", () => ({ validateGetTasksQuery: vi.fn() }));
vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: vi.fn(),
}));
vi.mock("@/lib/tasks/enrichTasks", () => ({ enrichTasks: vi.fn() }));
vi.mock("@/lib/plans/getTaskRunBlock", () => ({ getTaskRunBlock: vi.fn() }));

const ID = "123e4567-e89b-12d3-a456-426614174000";
const req = (q: string) => new NextRequest(`http://localhost/api/tasks${q}`);

describe("getTasksHandler plan_limit on the run path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(enrichTasks).mockImplementation(async t => t as never);
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns 402 for a single task the plan no longer allows", async () => {
    vi.mocked(validateGetTasksQuery).mockResolvedValue({ id: ID } as never);
    vi.mocked(selectScheduledActions).mockResolvedValue([{ id: ID, account_id: "acc" }] as never);
    const body = buildPlanLimitBody({ plan: "free", limit: "min_cadence", currentTaskCount: 1 });
    vi.mocked(getTaskRunBlock).mockResolvedValue(body);
    const res = await getTasksHandler(req(`?id=${ID}`));
    expect(res.status).toBe(402);
    await expect(res.json()).resolves.toEqual(body);
  });

  it("returns the task normally when the plan allows it, and never checks list queries", async () => {
    vi.mocked(validateGetTasksQuery).mockResolvedValue({ id: ID } as never);
    vi.mocked(selectScheduledActions).mockResolvedValue([{ id: ID, account_id: "acc" }] as never);
    vi.mocked(getTaskRunBlock).mockResolvedValue(null);
    expect((await getTasksHandler(req(`?id=${ID}`))).status).toBe(200);

    vi.mocked(validateGetTasksQuery).mockResolvedValue({ account_id: "acc" } as never);
    vi.mocked(selectScheduledActions).mockResolvedValue([{ id: ID }, { id: "x" }] as never);
    expect((await getTasksHandler(req("?account_id=acc"))).status).toBe(200);
    expect(getTaskRunBlock).toHaveBeenCalledTimes(1);
  });
});
