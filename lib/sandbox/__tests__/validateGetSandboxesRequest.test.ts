import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { validateGetSandboxesRequest } from "../validateGetSandboxesRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { buildGetSandboxesParams } from "../buildGetSandboxesParams";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("../buildGetSandboxesParams", () => ({
  buildGetSandboxesParams: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

/**
 * Creates a mock NextRequest for testing.
 *
 * @param queryParams - Optional query parameters
 * @returns A mock NextRequest object
 */
function createMockRequest(queryParams: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/sandboxes");
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return {
    url: url.toString(),
    headers: new Headers({ "x-api-key": "test-key" }),
  } as unknown as NextRequest;
}

describe("validateGetSandboxesRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("returns error when auth fails", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue(
        NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
      );

      const request = createMockRequest();
      const result = await validateGetSandboxesRequest(request);

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(401);
    });
  });

  describe("query parameter validation", () => {
    it("accepts valid sandbox_id parameter", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "acc_123",
        orgId: null,
        authToken: "token",
      });
      vi.mocked(buildGetSandboxesParams).mockResolvedValue({
        params: { accountIds: ["acc_123"], sandboxId: "sbx_specific" },
        error: null,
      });

      const request = createMockRequest({ sandbox_id: "sbx_specific" });
      const result = await validateGetSandboxesRequest(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({
        accountIds: ["acc_123"],
        sandboxId: "sbx_specific",
      });
    });

    it("rejects invalid account_id format (not UUID)", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "acc_123",
        orgId: null,
        authToken: "token",
      });

      const request = createMockRequest({ account_id: "invalid-not-uuid" });
      const result = await validateGetSandboxesRequest(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.status).toBe("error");
    });
  });

  describe("authorization via buildGetSandboxesParams", () => {
    it("returns 403 when buildGetSandboxesParams returns personal key error", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "acc_123",
        orgId: null,
        authToken: "token",
      });
      vi.mocked(buildGetSandboxesParams).mockResolvedValue({
        params: null,
        error: "Personal API keys cannot filter by account_id",
      });

      const request = createMockRequest({ account_id: "550e8400-e29b-41d4-a716-446655440000" });
      const result = await validateGetSandboxesRequest(request);

      expect(buildGetSandboxesParams).toHaveBeenCalledWith({
        account_id: "acc_123",
        org_id: null,
        target_account_id: "550e8400-e29b-41d4-a716-446655440000",
        sandbox_id: undefined,
      });
      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.status).toBe("error");
      expect(json.error).toBe("Personal API keys cannot filter by account_id");
    });

    it("returns 403 when buildGetSandboxesParams returns non-member error", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "org-123",
        orgId: "org-123",
        authToken: "token",
      });
      vi.mocked(buildGetSandboxesParams).mockResolvedValue({
        params: null,
        error: "account_id is not a member of this organization",
      });

      const request = createMockRequest({ account_id: "550e8400-e29b-41d4-a716-446655440000" });
      const result = await validateGetSandboxesRequest(request);

      expect(buildGetSandboxesParams).toHaveBeenCalledWith({
        account_id: "org-123",
        org_id: "org-123",
        target_account_id: "550e8400-e29b-41d4-a716-446655440000",
        sandbox_id: undefined,
      });
      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.status).toBe("error");
      expect(json.error).toBe("account_id is not a member of this organization");
    });

    it("passes target_account_id and sandbox_id to buildGetSandboxesParams", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "org-123",
        orgId: "org-123",
        authToken: "token",
      });
      vi.mocked(buildGetSandboxesParams).mockResolvedValue({
        params: { accountIds: ["550e8400-e29b-41d4-a716-446655440000"], sandboxId: "sbx_abc123" },
        error: null,
      });

      const request = createMockRequest({
        sandbox_id: "sbx_abc123",
        account_id: "550e8400-e29b-41d4-a716-446655440000",
      });
      const result = await validateGetSandboxesRequest(request);

      expect(buildGetSandboxesParams).toHaveBeenCalledWith({
        account_id: "org-123",
        org_id: "org-123",
        target_account_id: "550e8400-e29b-41d4-a716-446655440000",
        sandbox_id: "sbx_abc123",
      });
      expect(result).toEqual({
        accountIds: ["550e8400-e29b-41d4-a716-446655440000"],
        sandboxId: "sbx_abc123",
      });
    });
  });

  describe("default behavior", () => {
    it("returns params with accountIds for personal key", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "acc_123",
        orgId: null,
        authToken: "token",
      });
      vi.mocked(buildGetSandboxesParams).mockResolvedValue({
        params: { accountIds: ["acc_123"], sandboxId: undefined },
        error: null,
      });

      const request = createMockRequest();
      const result = await validateGetSandboxesRequest(request);

      expect(buildGetSandboxesParams).toHaveBeenCalledWith({
        account_id: "acc_123",
        org_id: null,
        target_account_id: undefined,
        sandbox_id: undefined,
      });
      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({
        accountIds: ["acc_123"],
        sandboxId: undefined,
      });
    });

    it("returns params with org member accountIds for org key", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "org_456",
        orgId: "org_456",
        authToken: "token",
      });
      vi.mocked(buildGetSandboxesParams).mockResolvedValue({
        params: { accountIds: ["member-1", "member-2"], sandboxId: undefined },
        error: null,
      });

      const request = createMockRequest();
      const result = await validateGetSandboxesRequest(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({
        accountIds: ["member-1", "member-2"],
        sandboxId: undefined,
      });
    });
  });
});
