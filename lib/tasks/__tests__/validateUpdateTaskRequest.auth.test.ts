import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateUpdateTaskRequest } from "@/lib/tasks/validateUpdateTaskRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ACCOUNT_B, authOk } from "@/lib/tasks/__tests__/fixtures/createTaskRequestTestFixtures";

const TASK_ID = "423e4567-e89b-12d3-a456-426614174000";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

describe("validateUpdateTaskRequest auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue(authOk);
  });

  it("returns 401 when validateAuthContext rejects", async () => {
    const authError = NextResponse.json(
      { status: "error", error: "Exactly one of x-api-key or Authorization must be provided" },
      { status: 401 },
    );
    vi.mocked(validateAuthContext).mockResolvedValue(authError);
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: JSON.stringify({ id: TASK_ID, title: "x" }),
    });
    const res = await validateUpdateTaskRequest(request);
    expect(res).toBe(authError);
  });

  it("returns 403 when validateAuthContext rejects body account_id override", async () => {
    const forbidden = NextResponse.json(
      { status: "error", error: "Access denied to specified account_id" },
      { status: 403 },
    );
    vi.mocked(validateAuthContext).mockResolvedValue(forbidden);
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer test.jwt" },
      body: JSON.stringify({ id: TASK_ID, account_id: ACCOUNT_B }),
    });
    const res = await validateUpdateTaskRequest(request);
    expect(res).toBe(forbidden);
  });

  it("calls validateAuthContext with body account_id override after body parse", async () => {
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: JSON.stringify({ id: TASK_ID, schedule: "0 0 * * *", account_id: ACCOUNT_B }),
    });
    vi.mocked(validateAuthContext).mockResolvedValue({ ...authOk, accountId: ACCOUNT_B });
    await validateUpdateTaskRequest(request);
    expect(validateAuthContext).toHaveBeenCalledWith(request, {
      accountId: ACCOUNT_B,
    });
  });
});
