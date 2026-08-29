import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { ABANDONED_CHECKOUT_EMAIL_LOG_TYPE, FOUNDER_FROM_EMAIL } from "@/lib/const";

const { selectLogMock, hasActiveSubMock, selectAccountByEmailMock, buildMock, sendMock, logMock } =
  vi.hoisted(() => ({
    selectLogMock: vi.fn(),
    hasActiveSubMock: vi.fn(),
    selectAccountByEmailMock: vi.fn(),
    buildMock: vi.fn(),
    sendMock: vi.fn(),
    logMock: vi.fn(),
  }));

vi.mock("@/lib/supabase/email_send_log/selectEmailSendLog", () => ({
  selectEmailSendLog: selectLogMock,
}));
vi.mock("@/lib/stripe/hasActiveSubscriptionForEmail", () => ({
  hasActiveSubscriptionForEmail: hasActiveSubMock,
}));
vi.mock("@/lib/supabase/account_emails/selectAccountByEmail", () => ({
  selectAccountByEmail: selectAccountByEmailMock,
}));
vi.mock("@/lib/emails/lifecycle/buildAbandonedCheckoutEmail", () => ({
  buildAbandonedCheckoutEmail: buildMock,
}));
vi.mock("@/lib/emails/sendEmail", () => ({ sendEmailWithResend: sendMock }));
vi.mock("@/lib/emails/logEmailAttempt", () => ({ logEmailAttempt: logMock }));

const { sendAbandonedCheckoutEmail } = await import("../sendAbandonedCheckoutEmail");

const args = { sessionId: "cs_test_1", email: "fan@example.com", plan: "pro" as const };

describe("sendAbandonedCheckoutEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    selectLogMock.mockResolvedValue([]);
    hasActiveSubMock.mockResolvedValue(false);
    selectAccountByEmailMock.mockResolvedValue({ account_id: "acc_1" });
    buildMock.mockReturnValue({ subject: "Want a hand?", html: "<p>hi</p>" });
    sendMock.mockResolvedValue({ id: "re_1" });
  });

  it("sends the founder email and logs a sent row keyed on the session", async () => {
    const result = await sendAbandonedCheckoutEmail(args);

    expect(sendMock).toHaveBeenCalledWith(
      {
        from: FOUNDER_FROM_EMAIL,
        to: ["fan@example.com"],
        subject: "Want a hand?",
        html: "<p>hi</p>",
      },
      { idempotencyKey: "abandoned_checkout_email/cs_test_1" },
    );
    const attempt = logMock.mock.calls[0][0];
    expect(attempt.status).toBe("sent");
    expect(attempt.accountId).toBe("acc_1");
    expect(attempt.resendId).toBe("re_1");
    expect(JSON.parse(attempt.rawBody)).toEqual({
      type: ABANDONED_CHECKOUT_EMAIL_LOG_TYPE,
      session_id: "cs_test_1",
      to: "fan@example.com",
      plan: "pro",
    });
    expect(result).toEqual({ sent: true });
  });

  it("skips when the email already has an active subscription", async () => {
    hasActiveSubMock.mockResolvedValue(true);
    expect(await sendAbandonedCheckoutEmail(args)).toEqual({ sent: false, reason: "subscribed" });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("skips when this session's email was already sent", async () => {
    selectLogMock.mockResolvedValue([{ id: "log_1" }]);
    expect(await sendAbandonedCheckoutEmail(args)).toEqual({ sent: false, reason: "already_sent" });
    expect(selectLogMock.mock.calls[0][0].rawBodyLike).toContain('"session_id":"cs_test_1"');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("logs a send_failed row with a null account when Resend rejects and no account exists", async () => {
    selectAccountByEmailMock.mockResolvedValue(null);
    sendMock.mockResolvedValue(NextResponse.json({ error: "x" }, { status: 502 }));

    expect(await sendAbandonedCheckoutEmail(args)).toEqual({ sent: false, reason: "send_failed" });
    const attempt = logMock.mock.calls[0][0];
    expect(attempt.status).toBe("send_failed");
    expect(attempt.accountId).toBeNull();
  });
});
