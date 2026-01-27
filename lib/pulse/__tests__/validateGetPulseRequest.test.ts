import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateGetPulseRequest } from "../validateGetPulseRequest";

/**
 * Creates a mock NextRequest for testing.
 *
 * @param url - The request URL
 * @param headers - Optional headers object
 * @returns A mock NextRequest
 */
function createMockRequest(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { headers });
}

describe("validateGetPulseRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication with x-api-key", () => {
    it("returns 401 when no auth is provided", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue(
        NextResponse.json(
          { status: "error", error: "Exactly one of x-api-key or Authorization must be provided" },
          { status: 401 },
        ),
      );

      const request = createMockRequest("https://api.example.com/api/pulse");
      const result = await validateGetPulseRequest(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(401);
      }
    });

    it("returns accountId when authenticated with x-api-key", async () => {
      const accountId = "account-123";
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "valid-key",
      });

      const request = createMockRequest("https://api.example.com/api/pulse", {
        "x-api-key": "valid-key",
      });
      const result = await validateGetPulseRequest(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ accountId });
    });
  });

  describe("authentication with Bearer token", () => {
    it("returns accountId when authenticated with Bearer token", async () => {
      const accountId = "account-456";
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "bearer-token",
      });

      const request = createMockRequest("https://api.example.com/api/pulse", {
        Authorization: "Bearer bearer-token",
      });
      const result = await validateGetPulseRequest(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ accountId });
    });

    it("returns 401 when Bearer token is invalid", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue(
        NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
      );

      const request = createMockRequest("https://api.example.com/api/pulse", {
        Authorization: "Bearer invalid-token",
      });
      const result = await validateGetPulseRequest(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(401);
      }
    });
  });

  describe("account_id override", () => {
    it("passes account_id to validateAuthContext when provided", async () => {
      const accountId = "account-123";
      const targetAccountId = "11111111-1111-4111-a111-111111111111";

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: targetAccountId,
        orgId: null,
        authToken: "valid-key",
      });

      const request = createMockRequest(
        `https://api.example.com/api/pulse?account_id=${targetAccountId}`,
        { "x-api-key": "org-api-key" },
      );
      const result = await validateGetPulseRequest(request);

      expect(validateAuthContext).toHaveBeenCalledWith(request, {
        accountId: targetAccountId,
      });
      expect(result).toEqual({ accountId: targetAccountId });
    });

    it("returns 403 when not authorized for account_id", async () => {
      const targetAccountId = "11111111-1111-4111-a111-111111111111";

      vi.mocked(validateAuthContext).mockResolvedValue(
        NextResponse.json(
          { status: "error", error: "Access denied to specified account_id" },
          { status: 403 },
        ),
      );

      const request = createMockRequest(
        `https://api.example.com/api/pulse?account_id=${targetAccountId}`,
        { "x-api-key": "org-api-key" },
      );
      const result = await validateGetPulseRequest(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(403);
      }
    });
  });
});
