import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import { CHAT_APP_URL, RECOUP_FROM_EMAIL, TRIAL_ENDING_EMAIL_LOG_TYPE } from "@/lib/const";

const {
  selectLogMock,
  selectAccountEmailsMock,
  sumCreditsMock,
  portalMock,
  buildMock,
  sendMock,
  logMock,
} = vi.hoisted(() => ({
  selectLogMock: vi.fn(),
  selectAccountEmailsMock: vi.fn(),
  sumCreditsMock: vi.fn(),
  portalMock: vi.fn(),
  buildMock: vi.fn(),
  sendMock: vi.fn(),
  logMock: vi.fn(),
}));

vi.mock("@/lib/supabase/email_send_log/selectEmailSendLog", () => ({
  selectEmailSendLog: selectLogMock,
}));
vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: selectAccountEmailsMock,
}));
vi.mock("@/lib/supabase/usage_events/sumCreditsDeducted", () => ({
  sumCreditsDeducted: sumCreditsMock,
}));
vi.mock("@/lib/stripe/createBillingPortalSession", () => ({
  createBillingPortalSession: portalMock,
}));
vi.mock("@/lib/emails/lifecycle/buildTrialEndingEmail", () => ({
  buildTrialEndingEmail: buildMock,
}));
vi.mock("@/lib/emails/sendEmail", () => ({ sendEmailWithResend: sendMock }));
vi.mock("@/lib/emails/logEmailAttempt", () => ({ logEmailAttempt: logMock }));

const { sendTrialEndingEmail } = await import("../sendTrialEndingEmail");

const subscription = {
  id: "sub_1",
  customer: "cus_1",
  metadata: { accountId: "acc_1" },
  trial_start: 1780000000,
  trial_end: 1782592000,
  items: { data: [{ price: { unit_amount: 9900, recurring: { interval: "month" } } }] },
} as unknown as Stripe.Subscription;

describe("sendTrialEndingEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    selectLogMock.mockImplementation(async (f: { rawBodyLike?: string }) =>
      f.rawBodyLike
        ? []
        : [
            { raw_body: '{"to":"x"}' },
            { raw_body: '{"type":"welcome_email"}' },
            { raw_body: "{}" },
          ],
    );
    selectAccountEmailsMock.mockResolvedValue([{ email: "fan@example.com" }]);
    sumCreditsMock.mockResolvedValue(14_500_000);
    portalMock.mockResolvedValue({ url: "https://billing.stripe.com/p/x" });
    buildMock.mockReturnValue({ subject: "Trial ends", html: "<p>x</p>" });
    sendMock.mockResolvedValue({ id: "re_2" });
  });

  it("builds the summary from usage rows since the trial started and sends it to the account email", async () => {
    await sendTrialEndingEmail(subscription);

    expect(sumCreditsMock).toHaveBeenCalledWith({
      accountId: "acc_1",
      createdAfter: new Date(1780000000 * 1000).toISOString(),
    });
    expect(portalMock).toHaveBeenCalledWith("cus_1", CHAT_APP_URL);
    expect(buildMock).toHaveBeenCalledWith({
      reportsSent: 2,
      creditsUsedUsd: 14.5,
      trialEndsOn: "2026-06-27",
      priceLine: "$99.00/month",
      portalUrl: "https://billing.stripe.com/p/x",
    });
    expect(sendMock).toHaveBeenCalledWith({
      from: RECOUP_FROM_EMAIL,
      to: ["fan@example.com"],
      subject: "Trial ends",
      html: "<p>x</p>",
    });
    const attempt = logMock.mock.calls[0][0];
    expect(attempt.status).toBe("sent");
    expect(attempt.accountId).toBe("acc_1");
    expect(JSON.parse(attempt.rawBody)).toEqual({
      type: TRIAL_ENDING_EMAIL_LOG_TYPE,
      subscription_id: "sub_1",
      to: "fan@example.com",
      subject: "Trial ends",
    });
  });

  it("is idempotent per subscription", async () => {
    selectLogMock.mockResolvedValue([{ id: "log_1" }]);
    await sendTrialEndingEmail(subscription);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("does nothing without an accountId or without a known email", async () => {
    await sendTrialEndingEmail({ ...subscription, metadata: {} } as unknown as Stripe.Subscription);
    selectAccountEmailsMock.mockResolvedValue([]);
    await sendTrialEndingEmail(subscription);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("never throws when a dependency fails", async () => {
    sumCreditsMock.mockRejectedValue(new Error("db"));
    await expect(sendTrialEndingEmail(subscription)).resolves.toBeUndefined();
  });
});
