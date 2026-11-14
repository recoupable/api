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
        { to: ["stranger@example.com"], subject: "Hi", text: "body" },
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
        { to: ["a@example.com"], cc: ["b@example.com"], subject: "Hi", text: "body" },
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

    it("returns 400 when neither html nor text is provided (no empty footer-only sends)", async () => {
      const request = createRequest({ to: ["d@example.com"] }, { "x-api-key": "k" });
      const result = await validateSendEmailBody(request);
      expect("error" in result).toBe(true);
      if ("error" in result) expect(result.error.status).toBe(400);
    });

    it("returns 400 when html is whitespace-only and no text is provided", async () => {
      const request = createRequest(
        { to: ["d@example.com"], subject: "Hi", html: "   " },
        { "x-api-key": "k" },
      );
      const result = await validateSendEmailBody(request);
      expect("error" in result).toBe(true);
      if ("error" in result) expect(result.error.status).toBe(400);
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
        {
          to: ["d@example.com"],
          subject: "s",
          account_id: "550e8400-e29b-41d4-a716-446655440000",
          text: "body",
        },
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
      const request = createRequest({ subject: "s", text: "body" }, { "x-api-key": "k" });
      const result = await validateSendEmailBody(request);

      expect("data" in result).toBe(true);
      if ("data" in result) {
        expect(result.data.to).toEqual(["owner@example.com", "owner.alt@example.com"]);
      }
    });

    it("returns 400 when 'to' is omitted and the account has no email on file", async () => {
      mockSelectAccountEmails.mockResolvedValue([]);
      const request = createRequest({ subject: "s", text: "body" }, { "x-api-key": "k" });
      const result = await validateSendEmailBody(request);
      expect("error" in result).toBe(true);
      if ("error" in result) expect(result.error.status).toBe(400);
    });

    it("does not resolve account emails when 'to' is provided", async () => {
      const request = createRequest(
        { to: ["dest@example.com"], subject: "s", text: "body" },
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
      const request = createRequest({ to: ["d@example.com"], subject: "s", text: "body" });
      const result = await validateSendEmailBody(request);
      expect("error" in result).toBe(true);
      if ("error" in result) expect(result.error.status).toBe(401);
    });
  });

  // recoupable/app#1949 F2: a rejected send records why, so the rejection rate is diagnosable.
  describe("rejection reason", () => {
    it("names the disallowed recipients and the sending account", async () => {
      mockAssertRecipientsAllowed.mockResolvedValue({
        allowed: false,
        disallowed: ["stranger@example.com", "other@example.com"],
      });
      const request = createRequest(
        { to: ["stranger@example.com", "other@example.com"], text: "body" },
        { "x-api-key": "k" },
      );
      const result = await validateSendEmailBody(request);
      expect(result).toMatchObject({
        reason: "recipient_not_allowed: stranger@example.com, other@example.com",
        accountId: "account-123",
      });
    });

    it("caps the recipients named in the reason", async () => {
      const disallowed = Array.from({ length: 8 }, (_, i) => `r${i}@example.com`);
      mockAssertRecipientsAllowed.mockResolvedValue({ allowed: false, disallowed });
      const request = createRequest({ to: disallowed, text: "body" }, { "x-api-key": "k" });
      const result = await validateSendEmailBody(request);
      expect(result).toMatchObject({
        reason:
          "recipient_not_allowed: r0@example.com, r1@example.com, r2@example.com, r3@example.com, r4@example.com and 3 more",
      });
    });

    it("names the failing field when the body is invalid", async () => {
      const request = createRequest({ to: ["d@example.com"], html: "   " }, { "x-api-key": "k" });
      const result = await validateSendEmailBody(request);
      expect(result).toMatchObject({
        reason: "invalid_body: html: a non-empty html or text body is required",
      });
      expect("accountId" in result && result.accountId).toBeFalsy();
    });

    it("records the account when it has no email on file", async () => {
      mockSelectAccountEmails.mockResolvedValue([]);
      const request = createRequest({ text: "body" }, { "x-api-key": "k" });
      const result = await validateSendEmailBody(request);
      expect(result).toMatchObject({ reason: "no_account_email", accountId: "account-123" });
    });

    it("records the auth status when authentication fails", async () => {
      mockValidateAuthContext.mockResolvedValue(
        NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
      );
      const request = createRequest({ to: ["d@example.com"], text: "body" });
      const result = await validateSendEmailBody(request);
      expect(result).toMatchObject({ reason: "auth_failed: 401" });
    });
  });
});
