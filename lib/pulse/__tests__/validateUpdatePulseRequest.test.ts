import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/networking/safeParseJson", () => ({
  safeParseJson: vi.fn(),
}));

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateUpdatePulseRequest } from "../validateUpdatePulseRequest";

/**
 * Creates a mock NextRequest for testing.
 *
 * @param url - The request URL
 * @param headers - Optional headers object
 * @returns A mock NextRequest
 */
function createMockRequest(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { method: "PATCH", headers });
}

describe("validateUpdatePulseRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("body validation", () => {
    it("returns 400 when active field is missing", async () => {
      vi.mocked(safeParseJson).mockResolvedValue({});

      const request = createMockRequest("https://api.example.com/api/pulse", {
        "x-api-key": "valid-key",
      });
      const result = await validateUpdatePulseRequest(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
      }
    });

    it("returns 400 when active is not a boolean", async () => {
      vi.mocked(safeParseJson).mockResolvedValue({ active: "true" });

      const request = createMockRequest("https://api.example.com/api/pulse", {
        "x-api-key": "valid-key",
      });
      const result = await validateUpdatePulseRequest(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
      }
    });
  });

  describe("authentication with x-api-key", () => {
    it("returns 401 when no auth is provided", async () => {
      vi.mocked(safeParseJson).mockResolvedValue({ active: true });
      vi.mocked(validateAuthContext).mockResolvedValue(
        NextResponse.json(
          { status: "error", error: "Exactly one of x-api-key or Authorization must be provided" },
          { status: 401 },
        ),
      );

      const request = createMockRequest("https://api.example.com/api/pulse");
      const result = await validateUpdatePulseRequest(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(401);
      }
    });

    it("returns accountId and active when authenticated with x-api-key", async () => {
      const accountId = "account-123";
      vi.mocked(safeParseJson).mockResolvedValue({ active: true });
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "valid-key",
      });

      const request = createMockRequest("https://api.example.com/api/pulse", {
        "x-api-key": "valid-key",
      });
      const result = await validateUpdatePulseRequest(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ accountId, active: true });
    });
  });

  describe("authentication with Bearer token", () => {
    it("returns accountId and active when authenticated with Bearer token", async () => {
      const accountId = "account-456";
      vi.mocked(safeParseJson).mockResolvedValue({ active: false });
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "bearer-token",
      });

      const request = createMockRequest("https://api.example.com/api/pulse", {
        Authorization: "Bearer bearer-token",
      });
      const result = await validateUpdatePulseRequest(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ accountId, active: false });
    });

    it("returns 401 when Bearer token is invalid", async () => {
      vi.mocked(safeParseJson).mockResolvedValue({ active: true });
      vi.mocked(validateAuthContext).mockResolvedValue(
        NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
      );

      const request = createMockRequest("https://api.example.com/api/pulse", {
        Authorization: "Bearer invalid-token",
      });
      const result = await validateUpdatePulseRequest(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(401);
      }
    });
  });

  describe("account_id override", () => {
    it("passes account_id to validateAuthContext when provided in body", async () => {
      const targetAccountId = "11111111-1111-4111-a111-111111111111";

      vi.mocked(safeParseJson).mockResolvedValue({ active: true, account_id: targetAccountId });
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: targetAccountId,
        orgId: null,
        authToken: "valid-key",
      });

      const request = createMockRequest("https://api.example.com/api/pulse", {
        "x-api-key": "org-api-key",
      });
      const result = await validateUpdatePulseRequest(request);

      expect(validateAuthContext).toHaveBeenCalledWith(request, {
        accountId: targetAccountId,
      });
      expect(result).toEqual({ accountId: targetAccountId, active: true });
    });

    it("returns 403 when not authorized for account_id", async () => {
      const targetAccountId = "11111111-1111-4111-a111-111111111111";

      vi.mocked(safeParseJson).mockResolvedValue({ active: true, account_id: targetAccountId });
      vi.mocked(validateAuthContext).mockResolvedValue(
        NextResponse.json(
          { status: "error", error: "Access denied to specified account_id" },
          { status: 403 },
        ),
      );

      const request = createMockRequest("https://api.example.com/api/pulse", {
        "x-api-key": "org-api-key",
      });
      const result = await validateUpdatePulseRequest(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(403);
      }
    });
  });
});
