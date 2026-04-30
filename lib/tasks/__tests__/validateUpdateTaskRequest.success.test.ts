import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateUpdateTaskRequest } from "@/lib/tasks/validateUpdateTaskRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import {
  ACCOUNT_A,
  ACCOUNT_B,
  authOk,
} from "@/lib/tasks/__tests__/fixtures/createTaskRequestTestFixtures";

const TASK_ID = "423e4567-e89b-12d3-a456-426614174000";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

describe("validateUpdateTaskRequest success", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue(authOk);
  });

  it("returns UpdateTaskPersistInput with resolvedAccountId when body omits account_id", async () => {
    const body = {
      id: TASK_ID,
      title: "Updated title",
    };
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: JSON.stringify(body),
    });
    const res = await validateUpdateTaskRequest(request);
    expect(res).not.toBeInstanceOf(NextResponse);
    expect(res).toEqual({
      id: TASK_ID,
      title: "Updated title",
      resolvedAccountId: ACCOUNT_A,
    });
    expect(validateAuthContext).toHaveBeenCalledWith(request, {
      accountId: undefined,
    });
  });

  it("returns UpdateTaskPersistInput when body account_id override is allowed", async () => {
    const body = { id: TASK_ID, enabled: false, account_id: ACCOUNT_B };
    vi.mocked(validateAuthContext).mockResolvedValue({
      ...authOk,
      accountId: ACCOUNT_B,
    });
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: JSON.stringify(body),
    });
    const res = await validateUpdateTaskRequest(request);
    expect(res).toEqual({
      id: TASK_ID,
      enabled: false,
      resolvedAccountId: ACCOUNT_B,
    });
    expect(validateAuthContext).toHaveBeenCalledWith(request, {
      accountId: ACCOUNT_B,
    });
  });
});
