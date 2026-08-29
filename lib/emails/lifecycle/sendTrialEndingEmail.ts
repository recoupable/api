import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { CHAT_APP_URL, RECOUP_FROM_EMAIL, TRIAL_ENDING_EMAIL_LOG_TYPE } from "@/lib/const";
import { creditsToUsd } from "@/lib/credits/creditsToUsd";
import { buildTrialEndingEmail } from "@/lib/emails/lifecycle/buildTrialEndingEmail";
import { countReportsSent } from "@/lib/emails/lifecycle/countReportsSent";
import { logEmailAttempt } from "@/lib/emails/logEmailAttempt";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { createBillingPortalSession } from "@/lib/stripe/createBillingPortalSession";
import { formatStripeTimestamp } from "@/lib/stripe/formatStripeTimestamp";
import { formatUsd } from "@/lib/stripe/formatUsd";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { selectEmailSendLog } from "@/lib/supabase/email_send_log/selectEmailSendLog";
import { sumCreditsDeducted } from "@/lib/supabase/usage_events/sumCreditsDeducted";

/**
 * Sends the customer the trial-ending summary when Stripe fires
 * `trial_will_end`. Numbers come from the account's own rows since
 * `trial_start`; the cancel link is a fresh billing-portal session.
 * Idempotent per subscription; best-effort (never throws) so the webhook
 * still 200s and the Telegram note still goes out.
 */
export async function sendTrialEndingEmail(subscription: Stripe.Subscription): Promise<void> {
  try {
    const accountId = subscription.metadata?.accountId;
    if (!accountId) return;

    const marker = `"type":"${TRIAL_ENDING_EMAIL_LOG_TYPE}","subscription_id":"${subscription.id}"`;
    const alreadySent = await selectEmailSendLog({ status: "sent", rawBodyLike: marker, limit: 1 });
    if (alreadySent.length > 0) return;

    const emailRows = await selectAccountEmails({ accountIds: accountId });
    const email = emailRows.find(row => row.email)?.email;
    if (!email) return;

    const trialStart = new Date((subscription.trial_start ?? subscription.start_date) * 1000);
    const customerId =
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
    const price = subscription.items?.data?.[0]?.price;
    const priceLine =
      price?.unit_amount != null && price.recurring?.interval
        ? `${formatUsd(price.unit_amount)}/${price.recurring.interval}`
        : "your plan price";

    const [reportsSent, creditsUsed, portal] = await Promise.all([
      countReportsSent(accountId, trialStart.toISOString()),
      sumCreditsDeducted({ accountId, createdAfter: trialStart.toISOString() }),
      createBillingPortalSession(customerId, CHAT_APP_URL),
    ]);

    const { subject, html } = buildTrialEndingEmail({
      reportsSent,
      creditsUsedUsd: creditsToUsd(creditsUsed),
      trialEndsOn: formatStripeTimestamp(subscription.trial_end ?? subscription.current_period_end),
      priceLine,
      portalUrl: portal.url,
    });
    const rawBody = JSON.stringify({
      type: TRIAL_ENDING_EMAIL_LOG_TYPE,
      subscription_id: subscription.id,
      to: email,
      subject,
    });

    // Resend dedupes on the key for 24h, so overlapping webhook deliveries
    // cannot produce two emails even if both pass the log check.
    const result = await sendEmailWithResend(
      { from: RECOUP_FROM_EMAIL, to: [email], subject, html },
      { idempotencyKey: `${TRIAL_ENDING_EMAIL_LOG_TYPE}/${subscription.id}` },
    );
    if (result instanceof NextResponse) {
      await logEmailAttempt({ rawBody, status: "send_failed", accountId });
      return;
    }
    await logEmailAttempt({ rawBody, status: "sent", accountId, resendId: result.id });
  } catch (error) {
    console.error("sendTrialEndingEmail failed (swallowed):", error);
  }
}
