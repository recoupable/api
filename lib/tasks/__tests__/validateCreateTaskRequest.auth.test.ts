import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateTaskRequest } from "@/lib/tasks/validateCreateTaskRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import {
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

  it("returns 401 when validateAuthContext rejects before body parse", async () => {
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
    expect(validateAuthContext).toHaveBeenCalledWith(request, {});
  });

  it("calls validateAuthContext with empty input (auth before body)", async () => {
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: JSON.stringify(validCreateBody()),
    });
    await validateCreateTaskRequest(request);
    expect(validateAuthContext).toHaveBeenCalledTimes(1);
    expect(validateAuthContext).toHaveBeenCalledWith(request, {});
  });
});
