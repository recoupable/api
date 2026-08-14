import type Stripe from "stripe";
import { buildSubscriptionSalesContext } from "@/lib/stripe/buildSubscriptionSalesContext";
import { formatStripeTimestamp } from "@/lib/stripe/formatStripeTimestamp";
import { sendSalesNotification } from "@/lib/telegram/sendSalesNotification";

/**
 * Webhook processor for `customer.subscription.updated`. Only the
 * `cancel_at_period_end` flip is a sales signal: false→true is churn
 * scheduled (the human decision moment, days before the subscription
 * actually ends — the window where outreach can still save the customer),
 * true→false is a saved customer. Every other update (metadata, renewal,
 * plan tweaks) stays silent.
 */
export async function processSubscriptionUpdated(
  subscription: Stripe.Subscription,
  previousAttributes: Partial<Stripe.Subscription> | undefined,
): Promise<void> {
  const previous = previousAttributes?.cancel_at_period_end;
  const current = subscription.cancel_at_period_end;
  if (typeof previous !== "boolean" || previous === current) return;

  const ctx = await buildSubscriptionSalesContext(subscription);

  const lines = current
    ? ["⚠️ Churn scheduled — cancels at period end", ctx.customerLine, ctx.planLine]
    : ["💚 Cancellation withdrawn — customer saved", ctx.customerLine, ctx.planLine];

  if (current && subscription.cancel_at) {
    lines.push(`Cancels: ${formatStripeTimestamp(subscription.cancel_at)}`);
  }
  const { feedback, reason } = subscription.cancellation_details ?? {};
  if (current && feedback) lines.push(`Feedback: ${feedback}`);
  if (current && reason) lines.push(`Reason: ${reason}`);
  lines.push(ctx.lifetimeLine);

  await sendSalesNotification({ email: ctx.email, text: lines.join("\n") });
}
