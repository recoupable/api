import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateSendEmailBody } from "../validateSendEmailBody";

const mockValidateAuthContext = vi.fn();
const mockAssertRecipientsAllowed = vi.fn();

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));

vi.mock("@/lib/emails/assertRecipientsAllowed", () => ({
  assertRecipientsAllowed: (...args: unknown[]) => mockAssertRecipientsAllowed(...args),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/networking/safeParseJson", () => ({
  safeParseJson: vi.fn(async (req: Request) => req.json()),
}));

function createRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("validateSendEmailBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAuthContext.mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "test-api-key",
    });
    mockAssertRecipientsAllowed.mockResolvedValue({ allowed: true });
  });

  describe("recipient restriction", () => {
    it("returns 403 with disallowed recipients when the gate blocks", async () => {
      mockAssertRecipientsAllowed.mockResolvedValue({
        allowed: false,
        disallowed: ["stranger@example.com"],
      });
      const request = createRequest(
        { to: ["stranger@example.com"], subject: "Hi" },
        { "x-api-key": "test-api-key" },
      );
      const result = await validateSendEmailBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(403);
        const json = await result.json();
        expect(json.disallowed_recipients).toEqual(["stranger@example.com"]);
      }
    });

    it("checks to + cc together against the authenticated account", async () => {
      const request = createRequest(
        { to: ["a@example.com"], cc: ["b@example.com"], subject: "Hi" },
        { "x-api-key": "test-api-key" },
      );
      await validateSendEmailBody(request);

      expect(mockAssertRecipientsAllowed).toHaveBeenCalledWith({
        accountId: "account-123",
        recipients: ["a@example.com", "b@example.com"],
      });
    });
  });

  describe("successful validation", () => {
    it("returns validated data with to + subject + text", async () => {
      const request = createRequest(
        { to: ["dest@example.com"], subject: "Hi", text: "Hello world" },
        { "x-api-key": "test-api-key" },
      );
      const result = await validateSendEmailBody(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) {
        expect(result.to).toEqual(["dest@example.com"]);
        expect(result.subject).toBe("Hi");
        expect(result.text).toBe("Hello world");
        expect(result.accountId).toBe("account-123");
      }
    });

    it("returns validated data with all optional fields", async () => {
      const request = createRequest(
        {
          to: ["a@example.com", "b@example.com"],
          cc: ["cc@example.com"],
          subject: "Subject",
          text: "t",
          html: "<p>h</p>",
          headers: { "X-Custom": "v" },
          chat_id: "chat-1",
        },
        { "x-api-key": "test-api-key" },
      );
      const result = await validateSendEmailBody(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) {
        expect(result.to).toEqual(["a@example.com", "b@example.com"]);
        expect(result.cc).toEqual(["cc@example.com"]);
        expect(result.html).toBe("<p>h</p>");
        expect(result.headers).toEqual({ "X-Custom": "v" });
        expect(result.chat_id).toBe("chat-1");
      }
    });

    it("passes account_id override through to validateAuthContext", async () => {
      const request = createRequest(
        { to: ["d@example.com"], subject: "s", account_id: "550e8400-e29b-41d4-a716-446655440000" },
        { "x-api-key": "org-key" },
      );
      await validateSendEmailBody(request);
      expect(mockValidateAuthContext).toHaveBeenCalledWith(expect.anything(), {
        accountId: "550e8400-e29b-41d4-a716-446655440000",
      });
    });
  });

  describe("validation errors (400)", () => {
    it("rejects a missing 'to'", async () => {
      const request = createRequest({ subject: "s" }, { "x-api-key": "k" });
      const result = await validateSendEmailBody(request);
      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) expect(result.status).toBe(400);
    });

    it("rejects an empty 'to' array", async () => {
      const request = createRequest({ to: [], subject: "s" }, { "x-api-key": "k" });
      const result = await validateSendEmailBody(request);
      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) expect(result.status).toBe(400);
    });

    it("rejects a non-email recipient", async () => {
      const request = createRequest({ to: ["not-an-email"], subject: "s" }, { "x-api-key": "k" });
      const result = await validateSendEmailBody(request);
      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) expect(result.status).toBe(400);
    });

    it("rejects a missing subject", async () => {
      const request = createRequest({ to: ["d@example.com"] }, { "x-api-key": "k" });
      const result = await validateSendEmailBody(request);
      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) expect(result.status).toBe(400);
    });
  });

  describe("auth", () => {
    it("returns the auth NextResponse when validateAuthContext fails", async () => {
      mockValidateAuthContext.mockResolvedValue(
        NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
      );
      const request = createRequest({ to: ["d@example.com"], subject: "s" });
      const result = await validateSendEmailBody(request);
      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) expect(result.status).toBe(401);
    });
  });
});
