import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateTaskRequest } from "@/lib/tasks/validateCreateTaskRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import {
  ACCOUNT_B,
  authOk,
  validCreateBody,
} from "@/lib/tasks/__tests__/fixtures/createTaskRequestTestFixtures";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

describe("validateCreateTaskRequest auth", () => {
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
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: JSON.stringify(validCreateBody()),
    });
    const res = await validateCreateTaskRequest(request);
    expect(res).toBe(authError);
  });

  it("returns 403 when validateAuthContext rejects body account_id override", async () => {
    const forbidden = NextResponse.json(
      { status: "error", error: "Access denied to specified account_id" },
      { status: 403 },
    );
    vi.mocked(validateAuthContext).mockResolvedValue(forbidden);
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer test.jwt" },
      body: JSON.stringify(validCreateBody({ account_id: ACCOUNT_B })),
    });
    const res = await validateCreateTaskRequest(request);
    expect(res).toBe(forbidden);
  });

  it("calls validateAuthContext with body account_id override after body parse", async () => {
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: JSON.stringify(validCreateBody({ account_id: ACCOUNT_B })),
    });
    await validateCreateTaskRequest(request);
    expect(validateAuthContext).toHaveBeenCalledTimes(1);
    expect(validateAuthContext).toHaveBeenCalledWith(request, {
      accountId: ACCOUNT_B,
    });
  });

  it("calls validateAuthContext with undefined accountId when body omits account_id", async () => {
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: JSON.stringify(validCreateBody()),
    });
    await validateCreateTaskRequest(request);
    expect(validateAuthContext).toHaveBeenCalledWith(request, {
      accountId: undefined,
    });
  });
});
