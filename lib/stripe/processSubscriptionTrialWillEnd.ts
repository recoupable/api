import type Stripe from "stripe";
import { buildSubscriptionSalesContext } from "@/lib/stripe/buildSubscriptionSalesContext";
import { formatStripeTimestamp } from "@/lib/stripe/formatStripeTimestamp";
import { sendSalesNotification } from "@/lib/telegram/sendSalesNotification";

/**
 * Webhook processor for `customer.subscription.trial_will_end` (Stripe
 * fires it 3 days before the trial converts): the proactive-outreach
 * window before the customer decides whether to keep paying.
 */
export async function processSubscriptionTrialWillEnd(
  subscription: Stripe.Subscription,
): Promise<void> {
  const ctx = await buildSubscriptionSalesContext(subscription);

  const lines = ["⏳ Trial ending soon — reach out now", ctx.customerLine, ctx.planLine];
  if (subscription.trial_end) {
    lines.push(`Trial ends: ${formatStripeTimestamp(subscription.trial_end)}`);
  }
  lines.push(ctx.lifetimeLine);

  await sendSalesNotification({ email: ctx.email, text: lines.join("\n") });
}
