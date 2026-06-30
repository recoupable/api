import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { sendEmailHandler } from "../sendEmailHandler";

const mockValidateSendEmailBody = vi.fn();
const mockProcessAndSendEmail = vi.fn();
const mockLogEmailAttempt = vi.fn();

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
      to: ["dest@example.com"],
      cc: ["cc@example.com"],
      subject: "Weekly report",
      text: "body",
      chat_id: "chat-1",
      accountId: "account-123",
    });
    mockProcessAndSendEmail.mockResolvedValue({
      success: true,
      message: "Email sent successfully.",
      id: "resend-id-1",
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
    expect(mockLogEmailAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ status: "sent", resendId: "resend-id-1" }),
    );
  });

  it("propagates the NextResponse from validateSendEmailBody (auth/validation/recipient errors)", async () => {
    mockValidateSendEmailBody.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 }),
    );
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
      expect.objectContaining({ status: "send_failed", error: "resend boom" }),
    );
  });
});
