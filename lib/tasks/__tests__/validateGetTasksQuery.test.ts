import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateGetTasksQuery } from "../validateGetTasksQuery";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateAccountIdOverride } from "@/lib/auth/validateAccountIdOverride";
import { checkIsAdmin } from "@/lib/admins/checkIsAdmin";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/auth/validateAccountIdOverride", () => ({
  validateAccountIdOverride: vi.fn(),
}));

vi.mock("@/lib/admins/checkIsAdmin", () => ({
  checkIsAdmin: vi.fn(),
}));

/**
 * Create Mock Request.
 *
 * @param url - URL to process.
 * @returns - Computed result.
 */
function createMockRequest(url: string): NextRequest {
  return {
    url,
    nextUrl: new URL(url),
    headers: new Headers({ "x-api-key": "test-key" }),
  } as unknown as NextRequest;
}

describe("validateGetTasksQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth error when validateAuthContext fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const result = await validateGetTasksQuery(
      createMockRequest("http://localhost:3000/api/tasks"),
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect(validateAuthContext).toHaveBeenCalledTimes(1);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(401);
    }
  });

  it("returns authenticated account scope when no account_id override is provided", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
    });

    const result = await validateGetTasksQuery(
      createMockRequest(
        "http://localhost:3000/api/tasks?artist_account_id=artist_456&enabled=true",
      ),
    );

    expect(validateAuthContext).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      account_id: "acc_123",
      artist_account_id: "artist_456",
      enabled: true,
    });
    expect(checkIsAdmin).not.toHaveBeenCalled();
    expect(validateAccountIdOverride).not.toHaveBeenCalled();
  });

  it("allows admin account_id override directly", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "admin_acc",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(checkIsAdmin).mockResolvedValue(true);

    const result = await validateGetTasksQuery(
      createMockRequest("http://localhost:3000/api/tasks?account_id=other_acc"),
    );

    expect(validateAuthContext).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      account_id: "other_acc",
    });
    expect(checkIsAdmin).toHaveBeenCalledWith("admin_acc");
    expect(validateAccountIdOverride).not.toHaveBeenCalled();
  });

  it("delegates non-admin override checks to validateAccountIdOverride", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "org_owner_acc",
      orgId: "org_123",
      authToken: "token",
    });
    vi.mocked(checkIsAdmin).mockResolvedValue(false);
    vi.mocked(validateAccountIdOverride).mockResolvedValue({ accountId: "member_acc" });

    const result = await validateGetTasksQuery(
      createMockRequest("http://localhost:3000/api/tasks?account_id=member_acc&id=task_1"),
    );

    expect(validateAuthContext).toHaveBeenCalledTimes(1);
    expect(checkIsAdmin).toHaveBeenCalledWith("org_owner_acc");
    expect(result).toEqual({
      account_id: "member_acc",
      id: "task_1",
    });
    expect(validateAccountIdOverride).toHaveBeenCalledWith({
      currentAccountId: "org_owner_acc",
      targetAccountId: "member_acc",
    });
  });

  it("returns 403 when non-admin override is denied", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "org_owner_acc",
      orgId: "org_123",
      authToken: "token",
    });
    vi.mocked(checkIsAdmin).mockResolvedValue(false);
    vi.mocked(validateAccountIdOverride).mockResolvedValue(
      NextResponse.json(
        { status: "error", error: "Access denied to specified account_id" },
        { status: 403 },
      ),
    );

    const result = await validateGetTasksQuery(
      createMockRequest("http://localhost:3000/api/tasks?account_id=other_acc"),
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect(validateAuthContext).toHaveBeenCalledTimes(1);
    expect(checkIsAdmin).toHaveBeenCalledWith("org_owner_acc");
    expect(validateAccountIdOverride).toHaveBeenCalledTimes(1);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(403);
    }
  });
});
