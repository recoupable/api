import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { getAdminEmailsHandler } from "../getAdminEmailsHandler";
import { validateGetAdminEmailsQuery } from "../validateGetAdminEmailsQuery";
import { getAccountEmailIds } from "../getAccountEmailIds";
import { fetchResendEmail } from "@/lib/emails/fetchResendEmail";
import type { NextRequest } from "next/server";
import type { GetEmailResponseSuccess } from "resend";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetAdminEmailsQuery", () => ({
  validateGetAdminEmailsQuery: vi.fn(),
}));

vi.mock("../getAccountEmailIds", () => ({
  getAccountEmailIds: vi.fn(),
}));

vi.mock("@/lib/emails/fetchResendEmail", () => ({
  fetchResendEmail: vi.fn(),
}));

const mockResendEmail: GetEmailResponseSuccess = {
  id: "email-abc",
  from: "agent@recoupable.com",
  to: ["user@test.com"],
  cc: null,
  bcc: null,
  reply_to: null,
  subject: "Your Pulse",
  html: "<h1>Hello</h1>",
  text: "Hello",
  created_at: "2026-03-16T10:00:00Z",
  scheduled_at: null,
  last_event: "delivered",
  object: "email",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAdminEmailsHandler", () => {
  describe("email_id mode", () => {
    it("returns a single email by Resend ID", async () => {
      vi.mocked(validateGetAdminEmailsQuery).mockResolvedValueOnce({
        mode: "email",
        emailId: "email-abc",
      });
      vi.mocked(fetchResendEmail).mockResolvedValueOnce(mockResendEmail);

      const response = await getAdminEmailsHandler({} as NextRequest);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.emails).toHaveLength(1);
      expect(body.emails[0].id).toBe("email-abc");
      expect(body.emails[0].last_event).toBe("delivered");
      expect(getAccountEmailIds).not.toHaveBeenCalled();
    });

    it("returns empty when Resend returns no data", async () => {
      vi.mocked(validateGetAdminEmailsQuery).mockResolvedValueOnce({
        mode: "email",
        emailId: "email-bad",
      });
      vi.mocked(fetchResendEmail).mockResolvedValueOnce(null);

      const response = await getAdminEmailsHandler({} as NextRequest);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.emails).toEqual([]);
    });
  });

  describe("account_id mode", () => {
    it("returns full Resend email data for account", async () => {
      vi.mocked(validateGetAdminEmailsQuery).mockResolvedValueOnce({
        mode: "account",
        accountId: "acc-123",
      });
      vi.mocked(getAccountEmailIds).mockResolvedValueOnce(["email-abc"]);
      vi.mocked(fetchResendEmail).mockResolvedValueOnce(mockResendEmail);

      const response = await getAdminEmailsHandler({} as NextRequest);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.emails).toHaveLength(1);
      expect(body.emails[0]).toMatchObject({
        id: "email-abc",
        subject: "Your Pulse",
        html: "<h1>Hello</h1>",
        text: "Hello",
        last_event: "delivered",
      });
    });

    it("returns empty when no email IDs found", async () => {
      vi.mocked(validateGetAdminEmailsQuery).mockResolvedValueOnce({
        mode: "account",
        accountId: "acc-123",
      });
      vi.mocked(getAccountEmailIds).mockResolvedValueOnce([]);

      const response = await getAdminEmailsHandler({} as NextRequest);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.emails).toEqual([]);
    });
  });

  describe("validation", () => {
    it("returns validation error response directly", async () => {
      vi.mocked(validateGetAdminEmailsQuery).mockResolvedValueOnce(
        NextResponse.json({ status: "error" }, { status: 400 }),
      );

      const response = await getAdminEmailsHandler({} as NextRequest);

      expect(response.status).toBe(400);
    });
  });
});
