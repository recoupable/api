import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { RECOUP_FROM_EMAIL } from "@/lib/const";

const mockSelectWelcomeEmailLog = vi.fn();
vi.mock("@/lib/supabase/email_send_log/selectWelcomeEmailLog", () => ({
  selectWelcomeEmailLog: (...args: unknown[]) => mockSelectWelcomeEmailLog(...args),
}));

const mockBuildWelcomeEmail = vi.fn();
vi.mock("@/lib/emails/buildWelcomeEmail", () => ({
  buildWelcomeEmail: (...args: unknown[]) => mockBuildWelcomeEmail(...args),
}));

const mockSendEmailWithResend = vi.fn();
vi.mock("@/lib/emails/sendEmail", () => ({
  sendEmailWithResend: (...args: unknown[]) => mockSendEmailWithResend(...args),
}));

const mockLogEmailAttempt = vi.fn();
vi.mock("@/lib/emails/logEmailAttempt", () => ({
  logEmailAttempt: (...args: unknown[]) => mockLogEmailAttempt(...args),
}));

const { sendWelcomeEmail } = await import("../sendWelcomeEmail");

describe("sendWelcomeEmail", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectWelcomeEmailLog.mockResolvedValue(null);
    mockBuildWelcomeEmail.mockReturnValue({ subject: "Welcome to Recoup", html: "<p>hi</p>" });
    mockSendEmailWithResend.mockResolvedValue({ id: "re_1" });
    mockLogEmailAttempt.mockResolvedValue(undefined);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("sends the welcome email from the Recoup address and logs a sent attempt", async () => {
    await sendWelcomeEmail({ accountId: "acc-1", email: "new@example.com" });

    expect(mockSendEmailWithResend).toHaveBeenCalledWith({
      from: RECOUP_FROM_EMAIL,
      to: ["new@example.com"],
      subject: "Welcome to Recoup",
      html: "<p>hi</p>",
    });

    expect(mockLogEmailAttempt).toHaveBeenCalledTimes(1);
    const attempt = mockLogEmailAttempt.mock.calls[0][0];
    expect(attempt.status).toBe("sent");
    expect(attempt.accountId).toBe("acc-1");
    expect(attempt.resendId).toBe("re_1");
    expect(JSON.parse(attempt.rawBody)).toEqual({
      type: "welcome_email",
      to: "new@example.com",
      subject: "Welcome to Recoup",
    });
  });

  it("skips the send when a welcome email was already sent for the account", async () => {
    mockSelectWelcomeEmailLog.mockResolvedValue({ id: "log-1" });

    await sendWelcomeEmail({ accountId: "acc-1", email: "new@example.com" });

    expect(mockSendEmailWithResend).not.toHaveBeenCalled();
    expect(mockLogEmailAttempt).not.toHaveBeenCalled();
  });

  it("logs a send_failed attempt when Resend rejects the send", async () => {
    mockSendEmailWithResend.mockResolvedValue(
      NextResponse.json({ error: "Failed to send email" }, { status: 502 }),
    );

    await sendWelcomeEmail({ accountId: "acc-1", email: "new@example.com" });

    const attempt = mockLogEmailAttempt.mock.calls[0][0];
    expect(attempt.status).toBe("send_failed");
    expect(attempt.accountId).toBe("acc-1");
    expect(attempt.resendId).toBeUndefined();
  });

  it("never throws when a dependency fails", async () => {
    mockSendEmailWithResend.mockRejectedValue(new Error("network down"));

    await expect(
      sendWelcomeEmail({ accountId: "acc-1", email: "new@example.com" }),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});
