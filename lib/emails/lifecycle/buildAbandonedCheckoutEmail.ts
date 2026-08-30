import { CHAT_APP_URL } from "@/lib/const";

export type AbandonedCheckoutPlan = "starter" | "pro";

const PLAN_LABEL: Record<AbandonedCheckoutPlan, string> = { starter: "Starter", pro: "Pro" };

/**
 * The founder follow-up sent a day after a subscription checkout expires
 * without payment. Plain text on purpose: HTML reads as marketing automation.
 * Short, about the customer's first report, not the plan. Copy avoids em/en
 * dashes.
 *
 * @param args.plan - The plan whose checkout was abandoned.
 * @returns Subject and plain-text body.
 */
export function buildAbandonedCheckoutEmail(args: { plan: AbandonedCheckoutPlan }): {
  subject: string;
  text: string;
} {
  const plan = PLAN_LABEL[args.plan];

  const text = `Hi,

I saw you started ${plan} on Recoup yesterday and stopped at the card step. No problem at all. Most people who stop there had one question they could not answer on the page.

Want a hand setting up your first report? Tell me the artist and what you want to know every week (streams, playlist adds, social growth, all of it) and I will set the task up so the first one lands in your inbox on Monday.

Just reply to this email. I read every one.

Patrick
Cofounder, Recoup

${CHAT_APP_URL}`;

  return { subject: "Want a hand setting up your first report?", text };
}
