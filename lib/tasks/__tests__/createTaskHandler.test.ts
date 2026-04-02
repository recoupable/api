import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse, type NextRequest } from "next/server";
import { createTaskHandler } from "../createTaskHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { createTask } from "@/lib/tasks/createTask";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/tasks/createTask", () => ({
  createTask: vi.fn(),
}));

const mockValidateAuthContext = vi.mocked(validateAuthContext);
const mockCreateTask = vi.mocked(createTask);

/**
 *
 * @param body
 */
function createMockRequest(body: unknown): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
    headers: new Headers({ authorization: "Bearer token" }),
  } as unknown as NextRequest;
}

describe("createTaskHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth error when authentication fails", async () => {
    mockValidateAuthContext.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const result = await createTaskHandler(
      createMockRequest({
        title: "task",
        prompt: "prompt",
        schedule: "0 0 * * *",
        artist_account_id: "artist-1",
      }),
    );

    expect(result.status).toBe(401);
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it("uses authenticated accountId instead of body account_id", async () => {
    mockValidateAuthContext.mockResolvedValue({
      accountId: "auth-account-id",
      authToken: "token",
      orgId: null,
    });
    mockCreateTask.mockResolvedValue({
      id: "task-1",
      title: "task",
      prompt: "prompt",
      schedule: "0 0 * * *",
      account_id: "auth-account-id",
      artist_account_id: "artist-1",
      enabled: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      last_run: null,
      next_run: null,
      trigger_schedule_id: null,
      model: null,
    } as never);

    const result = await createTaskHandler(
      createMockRequest({
        title: "task",
        prompt: "prompt",
        schedule: "0 0 * * *",
        account_id: "body-account-id",
        artist_account_id: "artist-1",
      }),
    );

    expect(result.status).toBe(200);
    expect(mockValidateAuthContext).toHaveBeenCalledWith(expect.anything(), {
      accountId: "body-account-id",
    });
    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: "auth-account-id",
      }),
    );
  });
});
