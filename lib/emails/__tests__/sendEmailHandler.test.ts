import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { sendEmailHandler } from "../sendEmailHandler";

const mockValidateAuthContext = vi.fn();
const mockProcessAndSendEmail = vi.fn();
const mockAssertRecipientsAllowed = vi.fn();

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));

vi.mock("@/lib/emails/processAndSendEmail", () => ({
  processAndSendEmail: (...args: unknown[]) => mockProcessAndSendEmail(...args),
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

function createRequest(body: unknown): NextRequest {
  return new NextRequest("https://recoup-api.vercel.app/api/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
    body: JSON.stringify(body),
  });
}

describe("sendEmailHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAuthContext.mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "test-key",
    });
    mockProcessAndSendEmail.mockResolvedValue({
      success: true,
      message: "Email sent successfully.",
      id: "resend-id-1",
    });
    mockAssertRecipientsAllowed.mockResolvedValue({ allowed: true });
  });

  it("sends to the explicit recipients and maps chat_id to the footer link", async () => {
    const request = createRequest({
      to: ["dest@example.com"],
      cc: ["cc@example.com"],
      subject: "Weekly report",
      text: "body",
      chat_id: "chat-1",
    });
    const response = await sendEmailHandler(request);

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
    expect(mockAssertRecipientsAllowed).toHaveBeenCalledWith({
      accountId: "account-123",
      recipients: ["dest@example.com", "cc@example.com"],
    });
  });

  it("returns 403 when a recipient is disallowed without a payment method", async () => {
    mockAssertRecipientsAllowed.mockResolvedValue({
      allowed: false,
      disallowed: ["stranger@example.com"],
    });
    const response = await sendEmailHandler(
      createRequest({ to: ["stranger@example.com"], subject: "s" }),
    );
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.disallowed_recipients).toEqual(["stranger@example.com"]);
    expect(mockProcessAndSendEmail).not.toHaveBeenCalled();
  });

  it("returns 401 when authentication fails", async () => {
    mockValidateAuthContext.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );
    const response = await sendEmailHandler(createRequest({ to: ["d@example.com"], subject: "s" }));
    expect(response.status).toBe(401);
    expect(mockProcessAndSendEmail).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is invalid (no recipients)", async () => {
    const response = await sendEmailHandler(createRequest({ subject: "s" }));
    expect(response.status).toBe(400);
    expect(mockProcessAndSendEmail).not.toHaveBeenCalled();
  });

  it("returns 502 when Resend delivery fails", async () => {
    mockProcessAndSendEmail.mockResolvedValue({ success: false, error: "resend boom" });
    const response = await sendEmailHandler(createRequest({ to: ["d@example.com"], subject: "s" }));
    expect(response.status).toBe(502);
    const json = await response.json();
    expect(json.error).toBe("resend boom");
  });
});
