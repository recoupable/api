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
vi.mock("@/lib/auth/validateAccountIdOverride", () => ({
  validateAccountIdOverride: vi.fn(),
}));

describe("validateCreateTaskRequest body errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue(authOk);
  });

  it("returns 400 for invalid JSON after auth succeeds", async () => {
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: "not-json{",
    });
    const res = await validateCreateTaskRequest(request);
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
    await expect((res as NextResponse).json()).resolves.toMatchObject({
      status: "error",
      error: "Invalid JSON body",
    });
    expect(validateAuthContext).toHaveBeenCalledWith(request, {});
  });

  it("returns 400 when Zod fails (empty title)", async () => {
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: JSON.stringify({ title: "" }),
    });
    const res = await validateCreateTaskRequest(request);
    expect((res as NextResponse).status).toBe(400);
    expect(validateAuthContext).toHaveBeenCalledWith(request, {});
  });

  it("returns 400 when required fields are missing", async () => {
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: JSON.stringify({ title: "x" }),
    });
    const res = await validateCreateTaskRequest(request);
    expect((res as NextResponse).status).toBe(400);
  });

  it("returns 400 when body has unknown keys (strict schema)", async () => {
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: JSON.stringify({
        ...validCreateBody(),
        not_in_openapi: true,
      }),
    });
    const res = await validateCreateTaskRequest(request);
    expect((res as NextResponse).status).toBe(400);
  });
});
