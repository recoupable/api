import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";
import { findOrCreateAccountForCheckout } from "@/lib/stripe/checkout/findOrCreateAccountForCheckout";
import { stampSubscriptionAccount } from "@/lib/stripe/checkout/stampSubscriptionAccount";
import { WEBHOOK_CREATED_BY } from "@/lib/stripe/checkout/webhookCreatedBy";

const idOf = (ref: string | { id: string } | null | undefined) =>
  typeof ref === "string" ? ref : (ref?.id ?? null);

/**
 * Webhook processor for `checkout.session.completed` in subscription mode
 * for sessions minted without an account: links the subscription to the
 * account behind the billing email, creating it when needed. Idempotent on
 * the subscription's own `metadata.accountId`, so Stripe retries and
 * duplicate deliveries never create a second account.
 */
export async function processCheckoutSubscriptionCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (session.mode !== "subscription") return;
  if (session.metadata?.accountId) return;

  const email = (session.customer_details?.email ?? session.customer_email)?.toLowerCase();
  const subscriptionId = idOf(session.subscription);
  const customerId = idOf(session.customer);
  if (!email || !subscriptionId || !customerId) return;

  const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
  if (subscription.metadata?.accountId) return;

  const { accountId, created } = await findOrCreateAccountForCheckout(email);
  await stampSubscriptionAccount({
    subscriptionId,
    customerId,
    accountId,
    createdBy: created ? WEBHOOK_CREATED_BY : "",
  });
}
