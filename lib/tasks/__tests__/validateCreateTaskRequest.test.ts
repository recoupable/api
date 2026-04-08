import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateTaskRequest } from "@/lib/tasks/validateCreateTaskBody";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

const ACCOUNT_A = "123e4567-e89b-12d3-a456-426614174000";
const ACCOUNT_B = "223e4567-e89b-12d3-a456-426614174000";
const ARTIST_ID = "323e4567-e89b-12d3-a456-426614174000";

function validCreateBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "Daily report",
    prompt: "Summarize fans",
    schedule: "0 9 * * *",
    account_id: ACCOUNT_A,
    artist_account_id: ARTIST_ID,
    ...overrides,
  };
}

describe("validateCreateTaskRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when JSON body is invalid", async () => {
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "test-key",
      },
      body: "not-json{",
    });

    const res = await validateCreateTaskRequest(request);

    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
    await expect((res as NextResponse).json()).resolves.toMatchObject({
      status: "error",
      error: "Invalid JSON body",
    });
    expect(vi.mocked(validateAuthContext)).not.toHaveBeenCalled();
  });

  it("returns 400 when body fails Zod validation (empty title)", async () => {
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "test-key",
      },
      body: JSON.stringify({ title: "" }),
    });

    const res = await validateCreateTaskRequest(request);

    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
    expect(vi.mocked(validateAuthContext)).not.toHaveBeenCalled();
  });

  it("returns 400 when required fields are missing", async () => {
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "test-key",
      },
      body: JSON.stringify({ title: "x" }),
    });

    const res = await validateCreateTaskRequest(request);

    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
    expect(vi.mocked(validateAuthContext)).not.toHaveBeenCalled();
  });

  it("calls validateAuthContext with body account_id after Zod passes", async () => {
    const body = validCreateBody();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT_A,
      orgId: null,
      authToken: "token",
    });

    const request = new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "test-key",
      },
      body: JSON.stringify(body),
    });

    await validateCreateTaskRequest(request);

    expect(validateAuthContext).toHaveBeenCalledTimes(1);
    expect(validateAuthContext).toHaveBeenCalledWith(request, {
      accountId: ACCOUNT_A,
    });
  });

  it("returns 401 when validateAuthContext returns 401", async () => {
    const authError = NextResponse.json(
      {
        status: "error",
        error: "Exactly one of x-api-key or Authorization must be provided",
      },
      { status: 401 },
    );
    vi.mocked(validateAuthContext).mockResolvedValue(authError);

    const request = new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "test-key",
      },
      body: JSON.stringify(validCreateBody()),
    });

    const res = await validateCreateTaskRequest(request);

    expect(res).toBe(authError);
    expect((res as NextResponse).status).toBe(401);
  });

  it("returns 403 when validateAuthContext returns 403", async () => {
    const forbidden = NextResponse.json(
      { status: "error", error: "Access denied to specified account_id" },
      { status: 403 },
    );
    vi.mocked(validateAuthContext).mockResolvedValue(forbidden);

    const request = new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test.jwt",
      },
      body: JSON.stringify(validCreateBody({ account_id: ACCOUNT_B })),
    });

    const res = await validateCreateTaskRequest(request);

    expect(res).toBe(forbidden);
    expect((res as NextResponse).status).toBe(403);
  });

  it("returns CreateTaskBody with resolved auth account_id on success", async () => {
    const body = validCreateBody({ account_id: ACCOUNT_A });
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT_A,
      orgId: null,
      authToken: "key",
    });

    const request = new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "test-key",
      },
      body: JSON.stringify(body),
    });

    const res = await validateCreateTaskRequest(request);

    expect(res).not.toBeInstanceOf(NextResponse);
    expect(res).toEqual({
      ...body,
      account_id: ACCOUNT_A,
    });
  });

  it("returns CreateTaskBody with org-resolved account_id", async () => {
    const body = validCreateBody({ account_id: ACCOUNT_B });
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT_B,
      orgId: "org-1",
      authToken: "key",
    });

    const request = new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "test-key",
      },
      body: JSON.stringify(body),
    });

    const res = await validateCreateTaskRequest(request);

    expect(res).toEqual({
      ...body,
      account_id: ACCOUNT_B,
    });
  });

  it("does not call auth when account_id fails validation (empty string)", async () => {
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "test-key",
      },
      body: JSON.stringify(
        validCreateBody({
          account_id: "",
        }),
      ),
    });

    const res = await validateCreateTaskRequest(request);

    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
    expect(vi.mocked(validateAuthContext)).not.toHaveBeenCalled();
  });

  it("preserves optional model in returned body", async () => {
    const body = validCreateBody({ model: "anthropic/claude-sonnet-4.5" });
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT_A,
      orgId: null,
      authToken: "key",
    });

    const request = new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "test-key",
      },
      body: JSON.stringify(body),
    });

    const res = await validateCreateTaskRequest(request);

    expect(res).toMatchObject({
      model: "anthropic/claude-sonnet-4.5",
      account_id: ACCOUNT_A,
    });
  });
});
