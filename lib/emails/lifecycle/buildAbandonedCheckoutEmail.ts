export type AbandonedCheckoutPlan = "starter" | "pro";

const PLAN_LABEL: Record<AbandonedCheckoutPlan, string> = { starter: "Starter", pro: "Pro" };

const SITE_URL = "https://recoupable.dev";
const FOUNDER_LINKEDIN_URL = "https://www.linkedin.com/in/sweetmantech";

/**
 * Founder follow-up a day after subscription checkout expires without
 * payment. Plain text on purpose. Asks what they wanted done, not which
 * plan they "started". Copy avoids em/en dashes.
 *
 * @param args.plan - Plan on the abandoned checkout session.
 * @returns Subject and plain-text body.
 */
export function buildAbandonedCheckoutEmail(args: { plan: AbandonedCheckoutPlan }): {
  subject: string;
  text: string;
} {
  const plan = PLAN_LABEL[args.plan];

  const text = `Hi,

You started checkout for ${plan} yesterday and left before paying. No worries.

What outcome were you hoping Recoup would help with? Reply and tell me. If we can do it, I will set it up.

Patrick
Cofounder, Recoup
${FOUNDER_LINKEDIN_URL}
${SITE_URL}`;

  return { subject: "What outcome were you hoping Recoup would help with?", text };
}
