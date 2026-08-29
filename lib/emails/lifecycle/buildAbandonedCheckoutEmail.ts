import { CHAT_APP_URL } from "@/lib/const";
import { renderEmailLayout } from "@/lib/emails/renderEmailLayout";

export type AbandonedCheckoutPlan = "starter" | "pro";

const PLAN_LABEL: Record<AbandonedCheckoutPlan, string> = { starter: "Starter", pro: "Pro" };

/**
 * The founder follow-up sent a day after a subscription checkout expires
 * without payment. Short, plain, and about the customer's first report, not
 * the plan: the goal is a reply, so the email asks a question and offers to
 * do the setup. Copy avoids em/en dashes.
 *
 * @param args.plan - The plan whose checkout was abandoned.
 * @returns Subject and HTML body.
 */
export function buildAbandonedCheckoutEmail(args: { plan: AbandonedCheckoutPlan }): {
  subject: string;
  html: string;
} {
  const plan = PLAN_LABEL[args.plan];

  const bodyHtml = `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#0a0a0a">Hi,</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#0a0a0a">I saw you started ${plan} on Recoup yesterday and stopped at the card step. No problem at all. Most people who stop there had one question they could not answer on the page.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#0a0a0a">Want a hand setting up your first report? Tell me the artist and what you want to know every week (streams, playlist adds, social growth, all of it) and I will set the task up so the first one lands in your inbox on Monday.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#0a0a0a">Just reply to this email. I read every one.</p>
<p style="margin:0;font-size:15px;line-height:1.6;color:#0a0a0a">Patrick<br /><span style="color:#6b6b6b">Cofounder, Recoup</span></p>`;

  const html = renderEmailLayout({
    bodyHtml,
    cta: { label: "Pick up where you left off &rarr;", url: CHAT_APP_URL },
  });

  return { subject: "Want a hand setting up your first report?", html };
}
