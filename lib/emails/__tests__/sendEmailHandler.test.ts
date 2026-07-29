import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { sendEmailHandler } from "../sendEmailHandler";

const mockValidateSendEmailBody = vi.fn();
const mockProcessAndSendEmail = vi.fn();
const mockLogEmailAttempt = vi.fn();
const mockSelectAccountCatalog = vi.fn();

vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalog", () => ({
  selectAccountCatalog: (...args: unknown[]) => mockSelectAccountCatalog(...args),
}));

vi.mock("@/lib/emails/validateSendEmailBody", () => ({
  validateSendEmailBody: (...args: unknown[]) => mockValidateSendEmailBody(...args),
}));

vi.mock("@/lib/emails/processAndSendEmail", () => ({
  processAndSendEmail: (...args: unknown[]) => mockProcessAndSendEmail(...args),
}));

vi.mock("@/lib/emails/logEmailAttempt", () => ({
  logEmailAttempt: (...args: unknown[]) => mockLogEmailAttempt(...args),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

function createRequest(): NextRequest {
  return new NextRequest("https://recoup-api.vercel.app/api/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
    body: "{}",
  });
}

describe("sendEmailHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateSendEmailBody.mockResolvedValue({
      rawBody: '{"subject":"Weekly report"}',
      data: {
        to: ["dest@example.com"],
        cc: ["cc@example.com"],
        subject: "Weekly report",
        text: "body",
        chat_id: "chat-1",
        accountId: "account-123",
      },
    });
    mockProcessAndSendEmail.mockResolvedValue({
      success: true,
      message: "Email sent successfully.",
      id: "resend-id-1",
    });
  });

  // chat#1911 row 5: catalog_id passes through ONLY when the caller owns the
  // catalog - otherwise it is dropped and the email sends unchanged, so a
  // caller can never lead their email with someone else's valuation.
  describe("catalog_id ownership gate", () => {
    const catalogId = "740d5050-40ec-4892-a040-b78bb50fef2f";
    const withCatalog = () =>
      mockValidateSendEmailBody.mockResolvedValue({
        rawBody: "{}",
        data: {
          to: ["dest@example.com"],
          subject: "Weekly report",
          text: "body",
          catalog_id: catalogId,
          accountId: "account-123",
        },
      });

    it("passes catalog_id through when the account owns the catalog", async () => {
      withCatalog();
      mockSelectAccountCatalog.mockResolvedValue({ account: "account-123", catalog: catalogId });

      await sendEmailHandler(createRequest());

      expect(mockSelectAccountCatalog).toHaveBeenCalledWith({
        accountId: "account-123",
        catalogId,
      });
      expect(mockProcessAndSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ catalog_id: catalogId }),
      );
    });

    it("drops catalog_id when the catalog is not owned by the caller", async () => {
      withCatalog();
      mockSelectAccountCatalog.mockResolvedValue(null);

      const response = await sendEmailHandler(createRequest());

      expect(response.status).toBe(200);
      expect(mockProcessAndSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ catalog_id: undefined }),
      );
    });

    it("never checks ownership when no catalog_id is sent", async () => {
      await sendEmailHandler(createRequest());

      expect(mockSelectAccountCatalog).not.toHaveBeenCalled();
    });
  });

  it("sends to the validated recipients and maps chat_id to the footer link", async () => {
    const response = await sendEmailHandler(createRequest());

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ success: true, message: "Email sent successfully.", id: "resend-id-1" });

    // Public field is chat_id; processAndSendEmail keeps the internal room_id arg.
    expect(mockProcessAndSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["dest@example.com"],
        cc: ["cc@example.com"],
        subject: "Weekly report",
        text: "body",
        room_id: "chat-1",
      }),
    );
    // Single call, on every path (DRY); rawBody comes from validateSendEmailBody (SRP).
    expect(mockLogEmailAttempt).toHaveBeenCalledTimes(1);
    expect(mockLogEmailAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "sent",
        resendId: "resend-id-1",
        rawBody: '{"subject":"Weekly report"}',
        accountId: "account-123",
        chatId: "chat-1",
      }),
    );
  });

  it("propagates the NextResponse from validateSendEmailBody (auth/validation/recipient errors)", async () => {
    mockValidateSendEmailBody.mockResolvedValue({
      rawBody: "{}",
      error: NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 }),
    });
    const response = await sendEmailHandler(createRequest());
    expect(response.status).toBe(403);
    expect(mockProcessAndSendEmail).not.toHaveBeenCalled();
    expect(mockLogEmailAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ status: "rejected" }),
    );
  });

  it("returns 502 when Resend delivery fails", async () => {
    mockProcessAndSendEmail.mockResolvedValue({ success: false, error: "resend boom" });
    const response = await sendEmailHandler(createRequest());
    expect(response.status).toBe(502);
    const json = await response.json();
    expect(json.error).toBe("resend boom");
    expect(mockLogEmailAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ status: "send_failed" }),
    );
  });
});
