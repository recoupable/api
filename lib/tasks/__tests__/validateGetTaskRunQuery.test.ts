import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateGetTaskRunQuery } from "../validateGetTaskRunQuery";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

/**
 * Creates a mock NextRequest with the given URL.
 *
 * @param url
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
});
