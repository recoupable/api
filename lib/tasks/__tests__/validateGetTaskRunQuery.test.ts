import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateGetTaskRunQuery } from "../validateGetTaskRunQuery";
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
 * Creates a mock NextRequest with the given URL.
 */
function createMockRequest(url: string): NextRequest {
  return {
    url,
    nextUrl: new URL(url),
    headers: new Headers({ "x-api-key": "test-key" }),
  } as unknown as NextRequest;
}

describe("validateGetTaskRunQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("auth validation", () => {
    it("returns 401 when auth validation fails", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue(
        NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
      );
      const request = createMockRequest("http://localhost:3000/api/tasks/runs?runId=run_123");

      const result = await validateGetTaskRunQuery(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(401);
      }
    });

    it("calls validateAuthContext with the request", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "acc_123",
        orgId: null,
        authToken: "test-key",
      });
      const request = createMockRequest("http://localhost:3000/api/tasks/runs?runId=run_123");

      await validateGetTaskRunQuery(request);

      expect(validateAuthContext).toHaveBeenCalledWith(request);
    });
  });

  describe("query validation", () => {
    beforeEach(() => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "acc_123",
        orgId: null,
        authToken: "test-key",
      });
    });

    it("returns list mode when runId is missing", async () => {
      const request = createMockRequest("http://localhost:3000/api/tasks/runs");

      const result = await validateGetTaskRunQuery(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ mode: "list", accountId: "acc_123", limit: 20 });
    });

    it("returns list mode when runId is empty string", async () => {
      const request = createMockRequest("http://localhost:3000/api/tasks/runs?runId=");

      const result = await validateGetTaskRunQuery(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ mode: "list", accountId: "acc_123", limit: 20 });
    });

    it("returns retrieve mode with validated runId when provided", async () => {
      const request = createMockRequest("http://localhost:3000/api/tasks/runs?runId=run_abc123");

      const result = await validateGetTaskRunQuery(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ mode: "retrieve", runId: "run_abc123" });
    });

    it("trims whitespace from runId", async () => {
      const request = createMockRequest(
        "http://localhost:3000/api/tasks/runs?runId=%20run_abc123%20",
      );

      const result = await validateGetTaskRunQuery(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ mode: "retrieve", runId: "run_abc123" });
    });

    it("returns list mode with custom limit", async () => {
      const request = createMockRequest("http://localhost:3000/api/tasks/runs?limit=50");

      const result = await validateGetTaskRunQuery(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ mode: "list", accountId: "acc_123", limit: 50 });
    });
  });

  describe("account_id override", () => {
    it("allows admin to query any account", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "admin_acc",
        orgId: null,
        authToken: "bearer-token",
      });
      vi.mocked(checkIsAdmin).mockResolvedValue(true);

      const request = createMockRequest(
        "http://localhost:3000/api/tasks/runs?account_id=other_acc",
      );

      const result = await validateGetTaskRunQuery(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ mode: "list", accountId: "other_acc", limit: 20 });
      expect(checkIsAdmin).toHaveBeenCalledWith("admin_acc");
      expect(validateAccountIdOverride).not.toHaveBeenCalled();
    });

    it("delegates to validateAccountIdOverride for non-admin", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "org_owner_acc",
        orgId: "org_123",
        authToken: "api-key",
      });
      vi.mocked(checkIsAdmin).mockResolvedValue(false);
      vi.mocked(validateAccountIdOverride).mockResolvedValue({ accountId: "member_acc" });

      const request = createMockRequest(
        "http://localhost:3000/api/tasks/runs?account_id=member_acc",
      );

      const result = await validateGetTaskRunQuery(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ mode: "list", accountId: "member_acc", limit: 20 });
      expect(validateAccountIdOverride).toHaveBeenCalledWith({
        currentAccountId: "org_owner_acc",
        targetAccountId: "member_acc",
      });
    });

    it("returns 403 when validateAccountIdOverride denies access", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "org_owner_acc",
        orgId: "org_123",
        authToken: "api-key",
      });
      vi.mocked(checkIsAdmin).mockResolvedValue(false);
      vi.mocked(validateAccountIdOverride).mockResolvedValue(
        NextResponse.json(
          { status: "error", error: "Access denied to specified account_id" },
          { status: 403 },
        ),
      );

      const request = createMockRequest(
        "http://localhost:3000/api/tasks/runs?account_id=other_acc",
      );

      const result = await validateGetTaskRunQuery(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(403);
      }
    });

    it("allows self-access via validateAccountIdOverride", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "acc_123",
        orgId: null,
        authToken: "api-key",
      });
      vi.mocked(checkIsAdmin).mockResolvedValue(false);
      vi.mocked(validateAccountIdOverride).mockResolvedValue({ accountId: "acc_123" });

      const request = createMockRequest("http://localhost:3000/api/tasks/runs?account_id=acc_123");

      const result = await validateGetTaskRunQuery(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ mode: "list", accountId: "acc_123", limit: 20 });
    });
  });
});
