import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateSendEmailBody } from "../validateSendEmailBody";

const mockValidateAuthContext = vi.fn();
const mockAssertRecipientsAllowed = vi.fn();
const mockSelectAccountEmails = vi.fn();

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));

vi.mock("@/lib/emails/assertRecipientsAllowed", () => ({
  assertRecipientsAllowed: (...args: unknown[]) => mockAssertRecipientsAllowed(...args),
}));

vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: (...args: unknown[]) => mockSelectAccountEmails(...args),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
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
    mockSelectAccountEmails.mockResolvedValue([{ email: "owner@example.com" }]);
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

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.status).toBe(403);
        const json = await result.error.json();
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

  describe("subject defaulting", () => {
    it("defaults a missing subject to the body's first heading", async () => {
      const request = createRequest(
        { to: ["d@example.com"], text: "# Pulse Report\n\nbody" },
        { "x-api-key": "k" },
      );
      const result = await validateSendEmailBody(request);
      expect("data" in result).toBe(true);
      if ("data" in result) {
        expect(result.data.subject).toBe("Pulse Report");
      }
    });

    it("defaults to `Message from Recoup` when subject and body are empty", async () => {
      const request = createRequest({ to: ["d@example.com"] }, { "x-api-key": "k" });
      const result = await validateSendEmailBody(request);
      expect("data" in result).toBe(true);
      if ("data" in result) {
        expect(result.data.subject).toBe("Message from Recoup");
      }
    });
  });

  describe("successful validation", () => {
    it("returns validated data with to + subject + text", async () => {
      const request = createRequest(
        { to: ["dest@example.com"], subject: "Hi", text: "Hello world" },
        { "x-api-key": "test-api-key" },
      );
      const result = await validateSendEmailBody(request);

      expect("data" in result).toBe(true);
      if ("data" in result) {
        expect(result.data.to).toEqual(["dest@example.com"]);
        expect(result.data.subject).toBe("Hi");
        expect(result.data.text).toBe("Hello world");
        expect(result.data.accountId).toBe("account-123");
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

      expect("data" in result).toBe(true);
      if ("data" in result) {
        expect(result.data.to).toEqual(["a@example.com", "b@example.com"]);
        expect(result.data.cc).toEqual(["cc@example.com"]);
        expect(result.data.html).toBe("<p>h</p>");
        expect(result.data.headers).toEqual({ "X-Custom": "v" });
        expect(result.data.chat_id).toBe("chat-1");
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

  describe("default recipient (omitted 'to')", () => {
    it("defaults 'to' to the account's own email when omitted", async () => {
      mockSelectAccountEmails.mockResolvedValue([{ email: "owner@example.com" }]);
      const request = createRequest({ subject: "s", text: "hi" }, { "x-api-key": "k" });
      const result = await validateSendEmailBody(request);

      expect("data" in result).toBe(true);
      if ("data" in result) {
        expect(result.data.to).toEqual(["owner@example.com"]);
      }
      expect(mockSelectAccountEmails).toHaveBeenCalledWith({ accountIds: "account-123" });
    });

    it("includes every account email when the account has more than one", async () => {
      mockSelectAccountEmails.mockResolvedValue([
        { email: "owner@example.com" },
        { email: "owner.alt@example.com" },
      ]);
      const request = createRequest({ subject: "s" }, { "x-api-key": "k" });
      const result = await validateSendEmailBody(request);

      expect("data" in result).toBe(true);
      if ("data" in result) {
        expect(result.data.to).toEqual(["owner@example.com", "owner.alt@example.com"]);
      }
    });

    it("returns 400 when 'to' is omitted and the account has no email on file", async () => {
      mockSelectAccountEmails.mockResolvedValue([]);
      const request = createRequest({ subject: "s" }, { "x-api-key": "k" });
      const result = await validateSendEmailBody(request);
      expect("error" in result).toBe(true);
      if ("error" in result) expect(result.error.status).toBe(400);
    });

    it("does not resolve account emails when 'to' is provided", async () => {
      const request = createRequest(
        { to: ["dest@example.com"], subject: "s" },
        { "x-api-key": "k" },
      );
      await validateSendEmailBody(request);
      expect(mockSelectAccountEmails).not.toHaveBeenCalled();
    });
  });

  describe("validation errors (400)", () => {
    it("rejects an empty 'to' array", async () => {
      const request = createRequest({ to: [], subject: "s" }, { "x-api-key": "k" });
      const result = await validateSendEmailBody(request);
      expect("error" in result).toBe(true);
      if ("error" in result) expect(result.error.status).toBe(400);
    });

    it("rejects a non-email recipient", async () => {
      const request = createRequest({ to: ["not-an-email"], subject: "s" }, { "x-api-key": "k" });
      const result = await validateSendEmailBody(request);
      expect("error" in result).toBe(true);
      if ("error" in result) expect(result.error.status).toBe(400);
    });

    // subject is now optional (defaults from the body) — covered by "subject defaulting" above.
  });

  describe("auth", () => {
    it("returns the auth NextResponse when validateAuthContext fails", async () => {
      mockValidateAuthContext.mockResolvedValue(
        NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
      );
      const request = createRequest({ to: ["d@example.com"], subject: "s" });
      const result = await validateSendEmailBody(request);
      expect("error" in result).toBe(true);
      if ("error" in result) expect(result.error.status).toBe(401);
    });
  });
});
