import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateNotificationBody } from "../validateCreateNotificationBody";

const mockValidateAuthContext = vi.fn();

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/networking/safeParseJson", () => ({
  safeParseJson: vi.fn(async (req: Request) => req.json()),
}));

/**
 * Create Request.
 *
 * @param body - Request payload.
 * @param headers - Headers for the request.
 * @returns - Computed result.
 */
function createRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  const defaultHeaders: Record<string, string> = { "Content-Type": "application/json" };
  return new NextRequest("http://localhost/api/notifications", {
    method: "POST",
    headers: { ...defaultHeaders, ...headers },
    body: JSON.stringify(body),
  });
}

describe("validateCreateNotificationBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAuthContext.mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "test-api-key",
    });
  });

  describe("successful validation", () => {
    it("returns validated data with subject and text", async () => {
      const request = createRequest(
        { subject: "Test Subject", text: "Hello world" },
        { "x-api-key": "test-api-key" },
      );
      const result = await validateCreateNotificationBody(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) {
        expect(result.subject).toBe("Test Subject");
        expect(result.text).toBe("Hello world");
        expect(result.accountId).toBe("account-123");
      }
    });

    it("returns validated data with all optional fields", async () => {
      const request = createRequest(
        {
          cc: ["cc@example.com"],
          subject: "Test Subject",
          text: "Hello",
          html: "<p>Hello</p>",
          headers: { "X-Custom": "value" },
          room_id: "room-123",
        },
        { "x-api-key": "test-api-key" },
      );
      const result = await validateCreateNotificationBody(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) {
        expect(result.cc).toEqual(["cc@example.com"]);
        expect(result.subject).toBe("Test Subject");
        expect(result.text).toBe("Hello");
        expect(result.html).toBe("<p>Hello</p>");
        expect(result.headers).toEqual({ "X-Custom": "value" });
        expect(result.room_id).toBe("room-123");
        expect(result.accountId).toBe("account-123");
      }
    });

    it("accepts subject-only body", async () => {
      const request = createRequest({ subject: "Test Subject" }, { "x-api-key": "test-api-key" });
      const result = await validateCreateNotificationBody(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) {
        expect(result.subject).toBe("Test Subject");
        expect(result.accountId).toBe("account-123");
      }
    });

    it("uses account_id override for org API keys", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "550e8400-e29b-41d4-a716-446655440000",
        orgId: "org-id",
        authToken: "test-api-key",
      });

      const request = createRequest(
        { subject: "Test", account_id: "550e8400-e29b-41d4-a716-446655440000" },
        { "x-api-key": "test-api-key" },
      );
      const result = await validateCreateNotificationBody(request);

      expect(mockValidateAuthContext).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          accountId: "550e8400-e29b-41d4-a716-446655440000",
        }),
      );

      expect(result).not.toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) {
        expect(result.accountId).toBe("550e8400-e29b-41d4-a716-446655440000");
      }
    });

    it("passes undefined accountId to auth when account_id is omitted", async () => {
      const request = createRequest({ subject: "Test" }, { "x-api-key": "test-api-key" });
      await validateCreateNotificationBody(request);

      expect(mockValidateAuthContext).toHaveBeenCalledWith(expect.anything(), {
        accountId: undefined,
      });
    });
  });

  describe("schema validation errors", () => {
    it("returns 400 when subject is missing", async () => {
      const request = createRequest({ text: "Hello" }, { "x-api-key": "test-api-key" });
      const result = await validateCreateNotificationBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
      }
    });

    it("returns 400 when subject is empty", async () => {
      const request = createRequest({ subject: "" }, { "x-api-key": "test-api-key" });
      const result = await validateCreateNotificationBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
      }
    });

    it("returns 400 when cc contains invalid email", async () => {
      const request = createRequest(
        { subject: "Test", cc: ["not-valid"] },
        { "x-api-key": "test-api-key" },
      );
      const result = await validateCreateNotificationBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
      }
    });

    it("returns 400 when account_id is not a valid UUID", async () => {
      const request = createRequest(
        { subject: "Test", account_id: "invalid-uuid" },
        { "x-api-key": "test-api-key" },
      );
      const result = await validateCreateNotificationBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
      }
    });
  });

  describe("auth errors", () => {
    it("returns 401 when auth is missing", async () => {
      mockValidateAuthContext.mockResolvedValue(
        NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
      );

      const request = createRequest({ subject: "Test" });
      const result = await validateCreateNotificationBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(401);
      }
    });

    it("returns 403 when org API key lacks access to account_id", async () => {
      mockValidateAuthContext.mockResolvedValue(
        NextResponse.json(
          { status: "error", error: "Access denied to specified account_id" },
          { status: 403 },
        ),
      );

      const request = createRequest(
        { subject: "Test", account_id: "550e8400-e29b-41d4-a716-446655440000" },
        { "x-api-key": "test-api-key" },
      );
      const result = await validateCreateNotificationBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(403);
        const data = await result.json();
        expect(data.error).toBe("Access denied to specified account_id");
      }
    });
  });
});
