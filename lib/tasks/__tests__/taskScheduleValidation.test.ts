import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  createTaskBodySchema,
  createTaskPayloadSchema,
  mcpCreateTaskBodySchema,
} from "../createTaskSchemas";
import {
  updateTaskRestBodySchema,
  updateTaskPersistInputSchema,
  mcpUpdateTaskBodySchema,
} from "../updateTaskSchemas";
import { createTask } from "../createTask";
import { updateTask } from "../updateTask";
import { validateCreateTaskRequest } from "../validateCreateTaskRequest";
import { validateUpdateTaskRequest } from "../validateUpdateTaskRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { insertScheduledAction } from "@/lib/supabase/scheduled_actions/insertScheduledAction";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { updateScheduledAction } from "@/lib/supabase/scheduled_actions/updateScheduledAction";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { createSchedule } from "@/lib/trigger/createSchedule";
import { syncTriggerSchedule } from "@/lib/trigger/syncTriggerSchedule";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/plans/assertTaskWithinPlan", () => ({ assertTaskWithinPlan: vi.fn() }));
vi.mock("@/lib/supabase/scheduled_actions/insertScheduledAction", () => ({
  insertScheduledAction: vi.fn(),
}));
vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: vi.fn(),
}));
vi.mock("@/lib/supabase/scheduled_actions/updateScheduledAction", () => ({
  updateScheduledAction: vi.fn(),
}));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));
vi.mock("@/lib/trigger/createSchedule", () => ({ createSchedule: vi.fn() }));
vi.mock("@/lib/trigger/syncTriggerSchedule", () => ({ syncTriggerSchedule: vi.fn() }));

const accountId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const create = { title: "Report", prompt: "Summarize growth", artist_account_id: accountId };
const update = { id: taskId };

describe("task schedule validation before side effects", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    "not a cron",
    "H * * * *",
    "@secondly",
    "@weekdays",
    "99 * * * *",
    "0 25 * * *",
    "0 0 31 2 *",
    "0 0 31 2 1",
    "* * * * * *",
    "*\t*\t*\t*\t*\t*",
    "   ",
    "0 0 * MON *",
    "0 9 * * JAN",
    "? 9 * * *",
    "0 ? * * *",
    "0 9 * ? *",
  ])("rejects %j across REST, MCP and persistence schemas", schedule => {
    expect(createTaskBodySchema.safeParse({ ...create, schedule }).success).toBe(false);
    expect(mcpCreateTaskBodySchema.safeParse({ ...create, schedule }).success).toBe(false);
    expect(
      createTaskPayloadSchema.safeParse({ ...create, schedule, account_id: accountId }).success,
    ).toBe(false);
    expect(updateTaskRestBodySchema.safeParse({ ...update, schedule }).success).toBe(false);
    expect(mcpUpdateTaskBodySchema.safeParse({ ...update, schedule }).success).toBe(false);
    expect(
      updateTaskPersistInputSchema.safeParse({
        ...update,
        schedule,
        resolvedAccountId: accountId,
      }).success,
    ).toBe(false);
  });

  it.each([
    "0 9 * * 1",
    "*/15 * * * *",
    "0 9 * JAN MON",
    "0 0 L * *",
    "0 0 * * 1L",
    "@daily",
    "0 9 * * 1,MON",
    "0 9 * * MON-FRI,FRI",
    "0 0,*/6 * * *",
    "0,0 9 * * *",
    "0 9 * * L",
    "0 9 * * L,L",
    "0 9 31 FEB,FEB *",
  ])("preserves supported expression %j without rewriting it", schedule => {
    expect(createTaskBodySchema.parse({ ...create, schedule }).schedule).toBe(schedule);
    expect(mcpCreateTaskBodySchema.parse({ ...create, schedule }).schedule).toBe(schedule);
    expect(updateTaskRestBodySchema.parse({ ...update, schedule }).schedule).toBe(schedule);
    expect(mcpUpdateTaskBodySchema.parse({ ...update, schedule }).schedule).toBe(schedule);
    expect(
      createTaskPayloadSchema.parse({ ...create, schedule, account_id: accountId }).schedule,
    ).toBe(schedule);
    expect(
      updateTaskPersistInputSchema.parse({ ...update, schedule, resolvedAccountId: accountId })
        .schedule,
    ).toBe(schedule);
  });

  it("keeps schedule optional for non-schedule patches", () => {
    expect(
      updateTaskPersistInputSchema.parse({
        ...update,
        title: "New title",
        resolvedAccountId: accountId,
      }),
    ).not.toHaveProperty("schedule");
  });

  it.each(["0 9 * * 1,MON", "0 9 * * MON-FRI,FRI", "0 0,*/6 * * *"])(
    "passes supported overlapping list %j unchanged to persistence and scheduler",
    async schedule => {
      const task = {
        id: taskId,
        account_id: accountId,
        schedule: "0 9 * * 1",
        enabled: true,
        trigger_schedule_id: "fixture-schedule",
      };
      vi.mocked(insertScheduledAction).mockResolvedValue([task] as never);
      vi.mocked(updateScheduledAction).mockResolvedValue(task as never);
      vi.mocked(createSchedule).mockResolvedValue({ id: "fixture-schedule" } as never);
      vi.mocked(selectScheduledActions).mockResolvedValue([task] as never);
      vi.mocked(canAccessAccount).mockResolvedValue(true);
      vi.mocked(syncTriggerSchedule).mockResolvedValue("fixture-schedule");

      await createTask({ ...create, schedule, account_id: accountId });
      expect(insertScheduledAction).toHaveBeenCalledWith(expect.objectContaining({ schedule }));
      expect(createSchedule).toHaveBeenCalledWith(expect.objectContaining({ cron: schedule }));

      await updateTask({ ...update, schedule, resolvedAccountId: accountId });
      expect(syncTriggerSchedule).toHaveBeenCalledWith(
        expect.objectContaining({ cronExpression: schedule }),
      );
      expect(updateScheduledAction).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: taskId, schedule }),
      );
    },
  );

  it.each(["invalid", "0 0 * MON *", "0 9 * * JAN", "? 9 * * *"])(
    "rejects %j before direct database or scheduler calls",
    async schedule => {
      await expect(createTask({ ...create, schedule, account_id: accountId })).rejects.toThrow();
      await expect(
        updateTask({ ...update, schedule, resolvedAccountId: accountId }),
      ).rejects.toThrow();
      expect(insertScheduledAction).not.toHaveBeenCalled();
      expect(selectScheduledActions).not.toHaveBeenCalled();
      expect(createSchedule).not.toHaveBeenCalled();
      expect(syncTriggerSchedule).not.toHaveBeenCalled();
    },
  );

  it.each(
    ["POST", "PATCH"].flatMap(method =>
      ["invalid", "0 0 * MON *", "0 9 * * JAN", "? 9 * * *"].map(schedule => [method, schedule]),
    ),
  )("returns the existing HTTP validation envelope for %s / %s", async (method, schedule) => {
    const body = method === "POST" ? create : update;
    const request = new NextRequest("https://example.com/api/tasks", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, schedule }),
    });
    const response = await (
      method === "POST" ? validateCreateTaskRequest : validateUpdateTaskRequest
    )(request);
    expect(response).toBeInstanceOf(NextResponse);
    const error = response as NextResponse;
    expect(error.status).toBe(400);
    expect(await error.json()).toEqual({
      status: "error",
      error: expect.any(String),
      missing_fields: ["schedule"],
    });
    expect(error.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(validateAuthContext).not.toHaveBeenCalled();
  });
});
