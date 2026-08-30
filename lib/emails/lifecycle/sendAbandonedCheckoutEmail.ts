import { NextResponse } from "next/server";
import {
  ABANDONED_CHECKOUT_EMAIL_LOG_TYPE,
  FOUNDER_FROM_EMAIL,
  FOUNDER_REPLY_TO_EMAIL,
} from "@/lib/const";
import {
  buildAbandonedCheckoutEmail,
  type AbandonedCheckoutPlan,
} from "@/lib/emails/lifecycle/buildAbandonedCheckoutEmail";
import { logEmailAttempt } from "@/lib/emails/logEmailAttempt";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { hasActiveSubscriptionForEmail } from "@/lib/stripe/hasActiveSubscriptionForEmail";
import { selectAccountByEmailIlike } from "@/lib/supabase/account_emails/selectAccountByEmailIlike";
import { selectEmailSendLog } from "@/lib/supabase/email_send_log/selectEmailSendLog";

export type AbandonedCheckoutEmailArgs = {
  sessionId: string;
  email: string;
  plan: AbandonedCheckoutPlan;
};

export type AbandonedCheckoutEmailResult =
  | { sent: true }
  | { sent: false; reason: "already_sent" | "subscribed" | "send_failed" };

/**
 * Workflow step that sends the abandoned-checkout follow-up. Idempotent per
 * Stripe session (the log marker carries `session_id`) and suppressed when
 * the email has since subscribed. The account link on the log row is best
 * effort: most abandoners have no account yet.
 */
export async function sendAbandonedCheckoutEmail(
  args: AbandonedCheckoutEmailArgs,
): Promise<AbandonedCheckoutEmailResult> {
  "use step";
  const { sessionId, email, plan } = args;

  const alreadySent = await selectEmailSendLog({
    status: "sent",
    rawBodyLike: `"type":"${ABANDONED_CHECKOUT_EMAIL_LOG_TYPE}","session_id":"${sessionId}"`,
    limit: 1,
  });
  if (alreadySent.length > 0) return { sent: false, reason: "already_sent" };

  if (await hasActiveSubscriptionForEmail(email)) return { sent: false, reason: "subscribed" };

  const { subject, text } = buildAbandonedCheckoutEmail({ plan });
  const rawBody = JSON.stringify({
    type: ABANDONED_CHECKOUT_EMAIL_LOG_TYPE,
    session_id: sessionId,
    to: email,
    plan,
  });
  const account = await selectAccountByEmailIlike(email);
  const accountId = account?.account_id ?? null;

  // Resend dedupes on the key for 24h, so a retried webhook that started a
  // second workflow run cannot produce two emails.
  const result = await sendEmailWithResend(
    {
      from: FOUNDER_FROM_EMAIL,
      replyTo: FOUNDER_REPLY_TO_EMAIL,
      to: [email],
      subject,
      text,
    },
    { idempotencyKey: `${ABANDONED_CHECKOUT_EMAIL_LOG_TYPE}/${sessionId}` },
  );
  if (result instanceof NextResponse) {
    await logEmailAttempt({ rawBody, status: "send_failed", accountId });
    return { sent: false, reason: "send_failed" };
  }

  await logEmailAttempt({ rawBody, status: "sent", accountId, resendId: result.id });
  return { sent: true };
}
