import { CHAT_APP_URL } from "@/lib/const";
import { escapeHtml } from "@/lib/emails/escapeHtml";
import { getEmailFooter } from "@/lib/emails/getEmailFooter";
import { renderEmailLayout } from "@/lib/emails/renderEmailLayout";

export interface ScheduleConfirmationEmailParams {
  /** The scheduled task's title. */
  title: string;
  /** Human-readable cadence, e.g. "Mondays at 13:00 UTC". */
  cadence: string;
}

/**
 * Confirms a newly scheduled report: what it is, and when it will arrive
 * (chat#1889).
 *
 * This is the bridge between signing up and the first report landing. Without
 * it, a signup finishes onboarding and then hears nothing until a report shows
 * up days later, with no record that anything was actually scheduled.
 *
 * Chrome comes from the shared `renderEmailLayout` (api#784), so it reads as one
 * family with the welcome, valuation, and weekly-report emails. Copy avoids
 * em/en dashes.
 */
export function buildScheduleConfirmationEmail({
  title,
  cadence,
}: ScheduleConfirmationEmailParams): { subject: string; html: string } {
  const safeTitle = escapeHtml(title);
  const safeCadence = escapeHtml(cadence);

  const bodyHtml = `<p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b6b6b">Report scheduled</p>
<h1 style="margin:0 0 20px;font-size:24px;line-height:1.2;letter-spacing:-0.02em;color:#0a0a0a">${safeTitle} is set for ${safeCadence}.</h1>
<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#0a0a0a">Recoup will run it on that schedule and email you the result, so your catalog keeps getting measured without you asking.</p>
<p style="margin:0;font-size:14px;line-height:1.6;color:#6b6b6b">You can change the cadence, pause it, or add another report any time.</p>`;

  const html = renderEmailLayout({
    bodyHtml,
    cta: { label: "View your reports &rarr;", url: `${CHAT_APP_URL}/tasks` },
    footerHtml: getEmailFooter(),
  });

  return { subject: `Scheduled: ${title}`, html };
}
