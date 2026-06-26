import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { sendEmailHandler } from "../sendEmailHandler";

const mockValidateSendEmailBody = vi.fn();
const mockProcessAndSendEmail = vi.fn();
const mockEnsureCredits = vi.fn();
const mockRecordCreditDeduction = vi.fn();

vi.mock("@/lib/emails/validateSendEmailBody", () => ({
  validateSendEmailBody: (...args: unknown[]) => mockValidateSendEmailBody(...args),
}));

vi.mock("@/lib/emails/processAndSendEmail", () => ({
  processAndSendEmail: (...args: unknown[]) => mockProcessAndSendEmail(...args),
}));

vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: (...args: unknown[]) => mockEnsureCredits(...args),
}));

vi.mock("@/lib/credits/recordCreditDeduction", () => ({
  recordCreditDeduction: (...args: unknown[]) => mockRecordCreditDeduction(...args),
}));

vi.mock("@/lib/credits/const", () => ({
  CREDIT_AUTO_RECHARGE_FALLBACK_SUCCESS_URL: "https://chat.recoupable.com/credits",
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
    mockEnsureCredits.mockResolvedValue(null); // credits available → proceed
    mockRecordCreditDeduction.mockResolvedValue({ success: true });
  });

  it("gates on credits then charges 1 credit on a successful send", async () => {
    const response = await sendEmailHandler(createRequest());
    expect(response.status).toBe(200);
    expect(mockEnsureCredits).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "account-123", creditsToDeduct: 1 }),
    );
    expect(mockRecordCreditDeduction).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "account-123",
        creditsToDeduct: 1,
        source: "api",
        modelId: "POST /api/emails",
      }),
    );
  });

  it("returns the 402 short-circuit and does not send when credits are insufficient", async () => {
    mockEnsureCredits.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Insufficient credits" }, { status: 402 }),
    );
    const response = await sendEmailHandler(createRequest());
    expect(response.status).toBe(402);
    expect(mockProcessAndSendEmail).not.toHaveBeenCalled();
    expect(mockRecordCreditDeduction).not.toHaveBeenCalled();
  });

  it("does not charge when the send fails", async () => {
    mockProcessAndSendEmail.mockResolvedValue({ success: false, error: "resend boom" });
    const response = await sendEmailHandler(createRequest());
    expect(response.status).toBe(502);
    expect(mockRecordCreditDeduction).not.toHaveBeenCalled();
  });

  it("returns a controlled 500 with CORS when the credit gate throws", async () => {
    mockEnsureCredits.mockRejectedValue(new Error("stripe down"));
    const response = await sendEmailHandler(createRequest());
    expect(response.status).toBe(500);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const json = await response.json();
    expect(json.status).toBe("error");
    expect(mockProcessAndSendEmail).not.toHaveBeenCalled();
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
  });

  it("propagates the NextResponse from validateSendEmailBody (auth/validation/recipient errors)", async () => {
    mockValidateSendEmailBody.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 }),
    );
    const response = await sendEmailHandler(createRequest());
    expect(response.status).toBe(403);
    expect(mockProcessAndSendEmail).not.toHaveBeenCalled();
  });

  it("returns 502 when Resend delivery fails", async () => {
    mockProcessAndSendEmail.mockResolvedValue({ success: false, error: "resend boom" });
    const response = await sendEmailHandler(createRequest());
    expect(response.status).toBe(502);
    const json = await response.json();
    expect(json.error).toBe("resend boom");
  });
});
