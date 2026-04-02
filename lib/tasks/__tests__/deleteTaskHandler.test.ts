import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse, type NextRequest } from "next/server";
import { deleteTaskHandler } from "../deleteTaskHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { validateAccountIdOverride } from "@/lib/auth/validateAccountIdOverride";
import { deleteTask } from "@/lib/tasks/deleteTask";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: vi.fn(),
}));

vi.mock("@/lib/auth/validateAccountIdOverride", () => ({
  validateAccountIdOverride: vi.fn(),
}));

vi.mock("@/lib/tasks/deleteTask", () => ({
  deleteTask: vi.fn(),
}));

const mockValidateAuthContext = vi.mocked(validateAuthContext);
const mockSelectScheduledActions = vi.mocked(selectScheduledActions);
const mockValidateAccountIdOverride = vi.mocked(validateAccountIdOverride);
const mockDeleteTask = vi.mocked(deleteTask);

/**
 * Build a mocked NextRequest with a JSON body payload.
 *
 * @param body - Request body returned by the mocked json() call.
 * @returns A mocked NextRequest instance for handler tests.
 */
function createMockRequest(body: unknown): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
    headers: new Headers({ authorization: "Bearer token" }),
  } as unknown as NextRequest;
}

describe("deleteTaskHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth error when authentication fails", async () => {
    mockValidateAuthContext.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const result = await deleteTaskHandler(createMockRequest({ id: "task-1" }));

    expect(result.status).toBe(401);
    expect(mockDeleteTask).not.toHaveBeenCalled();
  });

  it("returns 403 when task account is not accessible", async () => {
    mockValidateAuthContext.mockResolvedValue({
      accountId: "acc-1",
      authToken: "token",
      orgId: null,
    });
    mockSelectScheduledActions.mockResolvedValue([{ id: "task-1", account_id: "acc-2" }] as never);
    mockValidateAccountIdOverride.mockResolvedValue(
      NextResponse.json(
        { status: "error", error: "Access denied to specified account_id" },
        { status: 403 },
      ),
    );

    const result = await deleteTaskHandler(createMockRequest({ id: "task-1" }));

    expect(result.status).toBe(403);
    expect(mockDeleteTask).not.toHaveBeenCalled();
  });

  it("deletes task when account access is allowed", async () => {
    mockValidateAuthContext.mockResolvedValue({
      accountId: "acc-1",
      authToken: "token",
      orgId: null,
    });
    mockSelectScheduledActions.mockResolvedValue([{ id: "task-1", account_id: "acc-1" }] as never);
    mockValidateAccountIdOverride.mockResolvedValue({ accountId: "acc-1" });
    mockDeleteTask.mockResolvedValue();

    const result = await deleteTaskHandler(createMockRequest({ id: "task-1" }));

    expect(result.status).toBe(200);
    expect(mockDeleteTask).toHaveBeenCalledWith({ id: "task-1" });
  });
});
