import type Stripe from "stripe";
import { buildSubscriptionSalesContext } from "@/lib/stripe/buildSubscriptionSalesContext";
import { formatStripeTimestamp } from "@/lib/stripe/formatStripeTimestamp";
import { sendSalesNotification } from "@/lib/telegram/sendSalesNotification";

/**
 * Webhook processor for `customer.subscription.created`: announces every
 * new subscription in the admin Telegram chat — including trials, which
 * are the "new card on file" moment sales outreach cares about.
 */
export async function processSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  const ctx = await buildSubscriptionSalesContext(subscription);
  const trialing = subscription.status === "trialing";

  const lines = [
    trialing ? "🆕 New subscription (trial) — new card on file" : "🆕 New subscription",
    ctx.customerLine,
    ctx.planLine,
  ];
  if (trialing && subscription.trial_end) {
    lines.push(`Trial ends: ${formatStripeTimestamp(subscription.trial_end)}`);
  }
  lines.push(ctx.lifetimeLine);

  await sendSalesNotification({ email: ctx.email, text: lines.join("\n") });
}
