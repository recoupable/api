import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getAdminEmailsHandler } from "../getAdminEmailsHandler";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";
import type { GetEmailResponseSuccess } from "resend";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/admins/validateAdminAuth", () => ({
  validateAdminAuth: vi.fn(),
}));

const mockSelectAccountEmailIds = vi.fn();
vi.mock("@/lib/supabase/memory_emails/selectAccountEmailIds", () => ({
  selectAccountEmailIds: (...args: unknown[]) => mockSelectAccountEmailIds(...args),
}));

const mockResendEmailsGet = vi.fn();
vi.mock("@/lib/emails/client", () => ({
  getResendClient: () => ({
    emails: { get: (...args: unknown[]) => mockResendEmailsGet(...args) },
  }),
}));

function createMockRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

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
  vi.mocked(validateAdminAuth).mockResolvedValue({ accountId: "admin-acc" });
});

describe("getAdminEmailsHandler", () => {
  describe("account_id mode", () => {
    it("returns full Resend email data for account_id query", async () => {
      mockSelectAccountEmailIds.mockResolvedValueOnce([
        { email_id: "email-abc", created_at: "2026-03-16T10:00:00Z" },
      ]);
      mockResendEmailsGet.mockResolvedValueOnce({ data: mockResendEmail });

      const request = createMockRequest("/api/admins/emails?account_id=acc-123");
      const response = await getAdminEmailsHandler(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.emails).toHaveLength(1);
      expect(body.emails[0]).toMatchObject({
        id: "email-abc",
        from: "agent@recoupable.com",
        to: ["user@test.com"],
        subject: "Your Pulse",
        html: "<h1>Hello</h1>",
        text: "Hello",
        last_event: "delivered",
        cc: null,
        bcc: null,
        reply_to: null,
        scheduled_at: null,
      });
    });
  });

  describe("email_id mode", () => {
    it("returns a single email by Resend ID", async () => {
      mockResendEmailsGet.mockResolvedValueOnce({ data: mockResendEmail });

      const request = createMockRequest("/api/admins/emails?email_id=email-abc");
      const response = await getAdminEmailsHandler(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.emails).toHaveLength(1);
      expect(body.emails[0].id).toBe("email-abc");
      expect(body.emails[0].last_event).toBe("delivered");
      expect(mockSelectAccountEmailIds).not.toHaveBeenCalled();
    });

    it("returns empty array when Resend returns no data", async () => {
      mockResendEmailsGet.mockResolvedValueOnce({ data: null });

      const request = createMockRequest("/api/admins/emails?email_id=email-bad");
      const response = await getAdminEmailsHandler(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.emails).toEqual([]);
    });
  });

  describe("validation", () => {
    it("returns 400 when neither account_id nor email_id provided", async () => {
      const request = createMockRequest("/api/admins/emails");
      const response = await getAdminEmailsHandler(request);

      expect(response.status).toBe(400);
    });

    it("returns auth error when not admin", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValueOnce(
        NextResponse.json({ status: "error" }, { status: 403 }),
      );

      const request = createMockRequest("/api/admins/emails?account_id=acc-123");
      const response = await getAdminEmailsHandler(request);

      expect(response.status).toBe(403);
    });
  });
});
