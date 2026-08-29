import { renderEmailLayout } from "@/lib/emails/renderEmailLayout";

export type TrialEndingEmailArgs = {
  /** Emails sent by the account's agents during the trial. */
  reportsSent: number;
  /** Dollar value of the credits spent during the trial. */
  creditsUsedUsd: number;
  /** ISO date (YYYY-MM-DD) the trial converts to a paid subscription. */
  trialEndsOn: string;
  /** Human price line, e.g. "$99.00/month". */
  priceLine: string;
  /** Stripe billing-portal URL where the customer can cancel. */
  portalUrl: string;
};

/**
 * Customer-facing email sent when Stripe fires `trial_will_end` (three days
 * before conversion). Leads with what the trial produced, then says exactly
 * what is charged, when, and what stops if they cancel. Copy avoids em/en
 * dashes.
 *
 * @returns Subject and HTML body.
 */
export function buildTrialEndingEmail(args: TrialEndingEmailArgs): {
  subject: string;
  html: string;
} {
  const reports = `${args.reportsSent} ${args.reportsSent === 1 ? "report" : "reports"}`;
  const credits = `$${args.creditsUsedUsd.toFixed(2)}`;

  const bodyHtml = `<p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b6b6b">Your trial</p>
<h1 style="margin:0 0 20px;font-size:24px;line-height:1.2;letter-spacing:-0.02em;color:#0a0a0a">Your Recoup trial ends on ${args.trialEndsOn}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#0a0a0a">So far your agents have sent ${reports} and used ${credits} in credits. On ${args.trialEndsOn} your card is charged ${args.priceLine} and Pro continues without interruption.</p>
<p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#0a0a0a">If you cancel before then, nothing is charged and these stop at the end of the trial:</p>
<ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.6;color:#0a0a0a">
  <li>Daily social monitoring for every artist on your roster</li>
  <li>Scheduled reports emailed to your team and artists</li>
  <li>API keys and the Pro credit allotment</li>
</ul>
<p style="margin:0;font-size:15px;line-height:1.6;color:#0a0a0a">You can cancel or change your plan any time from the billing portal below. Reply to this email if anything is unclear.</p>`;

  const html = renderEmailLayout({
    bodyHtml,
    cta: { label: "Manage or cancel your plan &rarr;", url: args.portalUrl },
  });

  return { subject: `Your Recoup trial ends on ${args.trialEndsOn}`, html };
}
