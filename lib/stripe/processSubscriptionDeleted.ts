import type Stripe from "stripe";
import { buildSubscriptionSalesContext } from "@/lib/stripe/buildSubscriptionSalesContext";
import { sendSalesNotification } from "@/lib/telegram/sendSalesNotification";

/**
 * Webhook processor for `customer.subscription.deleted`: the churn is
 * final — the subscription has actually ended (period end after a
 * scheduled cancellation, or an immediate cancel).
 */
export async function processSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const ctx = await buildSubscriptionSalesContext(subscription);

  const lines = ["❌ Subscription canceled — churn final", ctx.customerLine, ctx.planLine];
  const { feedback, reason } = subscription.cancellation_details ?? {};
  if (feedback) lines.push(`Feedback: ${feedback}`);
  if (reason) lines.push(`Reason: ${reason}`);
  lines.push(ctx.lifetimeLine);

  await sendSalesNotification({ email: ctx.email, text: lines.join("\n") });
}
