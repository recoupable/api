import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateTaskRequest } from "@/lib/tasks/validateCreateTaskRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import {
  ACCOUNT_A,
  authOk,
  validCreateBody,
} from "@/lib/tasks/__tests__/fixtures/createTaskRequestTestFixtures";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

describe("validateCreateTaskRequest success", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue(authOk);
  });

  it("returns CreateTaskBody with account_id from auth only", async () => {
    const body = validCreateBody();
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: JSON.stringify(body),
    });
    const res = await validateCreateTaskRequest(request);
    expect(res).not.toBeInstanceOf(NextResponse);
    expect(res).toEqual({ ...body, account_id: ACCOUNT_A });
  });

  it("preserves optional model", async () => {
    const body = validCreateBody({ model: "anthropic/claude-sonnet-4.5" });
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: JSON.stringify(body),
    });
    const res = await validateCreateTaskRequest(request);
    expect(res).toMatchObject({ model: "anthropic/claude-sonnet-4.5", account_id: ACCOUNT_A });
  });
});
