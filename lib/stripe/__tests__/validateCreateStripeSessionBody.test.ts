import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateStripeSessionBody } from "../validateCreateStripeSessionBody";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/networking/safeParseJson", () => ({
  safeParseJson: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const mockValidateAuthContext = vi.mocked(validateAuthContext);
const mockSafeParseJson = vi.mocked(safeParseJson);

function makeRequest(): NextRequest {
  return {
    headers: { get: (key: string) => (key === "x-api-key" ? "test-key" : null) },
  } as unknown as NextRequest;
}

describe("validateCreateStripeSessionBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful validation", () => {
    it("returns accountId and successUrl when valid", async () => {
      mockSafeParseJson.mockResolvedValue({
        successUrl: "https://chat.recoupable.com?success=1",
      });
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-uuid-111",
        orgId: null,
        authToken: "test-key",
      });

      const result = await validateCreateStripeSessionBody(makeRequest());

      expect(result).toEqual({
        accountId: "account-uuid-111",
        successUrl: "https://chat.recoupable.com?success=1",
      });
    });

    it("uses accountId override when provided and auth permits", async () => {
      const overrideId = "223e4567-e89b-12d3-a456-426614174001";
      mockSafeParseJson.mockResolvedValue({
        successUrl: "https://chat.recoupable.com?success=1",
        accountId: overrideId,
      });
      mockValidateAuthContext.mockResolvedValue({
        accountId: overrideId,
        orgId: null,
        authToken: "test-key",
      });

      const result = await validateCreateStripeSessionBody(makeRequest());

      expect(result).toEqual({
        accountId: overrideId,
        successUrl: "https://chat.recoupable.com?success=1",
      });
      expect(mockValidateAuthContext).toHaveBeenCalledWith(expect.anything(), {
        accountId: overrideId,
      });
    });
  });

  describe("body validation errors", () => {
    it("returns 400 when successUrl is missing", async () => {
      mockSafeParseJson.mockResolvedValue({});

      const result = await validateCreateStripeSessionBody(makeRequest());

      expect(result).toBeInstanceOf(NextResponse);
      const data = await (result as NextResponse).json();
      expect((result as NextResponse).status).toBe(400);
      expect(data.error).toBe("successUrl is required");
    });

    it("returns 400 when successUrl is not a valid URL", async () => {
      mockSafeParseJson.mockResolvedValue({ successUrl: "not-a-url" });

      const result = await validateCreateStripeSessionBody(makeRequest());

      expect(result).toBeInstanceOf(NextResponse);
      const data = await (result as NextResponse).json();
      expect((result as NextResponse).status).toBe(400);
      expect(data.error).toBe("successUrl must be a valid URL");
    });

    it("returns 400 when accountId is not a valid UUID", async () => {
      mockSafeParseJson.mockResolvedValue({
        successUrl: "https://example.com",
        accountId: "not-a-uuid",
      });

      const result = await validateCreateStripeSessionBody(makeRequest());

      expect(result).toBeInstanceOf(NextResponse);
      const data = await (result as NextResponse).json();
      expect((result as NextResponse).status).toBe(400);
      expect(data.error).toBe("accountId must be a valid UUID");
    });
  });

  describe("auth errors", () => {
    it("passes through 401 from validateAuthContext", async () => {
      mockSafeParseJson.mockResolvedValue({
        successUrl: "https://example.com",
      });
      mockValidateAuthContext.mockResolvedValue(
        NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
      );

      const result = await validateCreateStripeSessionBody(makeRequest());

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(401);
    });

    it("passes through 403 from validateAuthContext", async () => {
      mockSafeParseJson.mockResolvedValue({
        successUrl: "https://example.com",
        accountId: "123e4567-e89b-12d3-a456-426614174000",
      });
      mockValidateAuthContext.mockResolvedValue(
        NextResponse.json({ status: "error", error: "Access denied" }, { status: 403 }),
      );

      const result = await validateCreateStripeSessionBody(makeRequest());

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(403);
    });
  });
});
