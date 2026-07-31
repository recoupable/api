import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateDeleteTaskRequest } from "@/lib/tasks/validateDeleteTaskRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

const TASK_ID = "423e4567-e89b-12d3-a456-426614174000";
const ACCOUNT_ID = "123e4567-e89b-12d3-a456-426614174000";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

describe("validateDeleteTaskRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT_ID,
      orgId: null,
      authToken: "token",
    });
  });

  it("returns id and resolvedAccountId for valid request", async () => {
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: JSON.stringify({ id: TASK_ID }),
    });

    const res = await validateDeleteTaskRequest(request);
    expect(res).toEqual({ id: TASK_ID, resolvedAccountId: ACCOUNT_ID });
  });

  it("returns 400 for invalid UUID id", async () => {
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: JSON.stringify({ id: "not-a-uuid" }),
    });

    const res = await validateDeleteTaskRequest(request);
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
  });

  it("returns auth error from validateAuthContext", async () => {
    const forbidden = NextResponse.json(
      { status: "error", error: "Access denied to specified account_id" },
      { status: 403 },
    );
    vi.mocked(validateAuthContext).mockResolvedValue(forbidden);

    const request = new NextRequest("http://localhost/api/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: JSON.stringify({ id: TASK_ID }),
    });

    const res = await validateDeleteTaskRequest(request);
    expect(res).toBe(forbidden);
  });

  it("forwards body account_id to validateAuthContext as the override (chat#1918)", async () => {
    const OTHER = "999e4567-e89b-12d3-a456-426614174999";
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: JSON.stringify({ id: TASK_ID, account_id: OTHER }),
    });
    await validateDeleteTaskRequest(request);
    expect(validateAuthContext).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accountId: OTHER }),
    );
  });

  it("rejects a non-UUID account_id with 400", async () => {
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: JSON.stringify({ id: TASK_ID, account_id: "not-a-uuid" }),
    });
    const result = await validateDeleteTaskRequest(request);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });
});
