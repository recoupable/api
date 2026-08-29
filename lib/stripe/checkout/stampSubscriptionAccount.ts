import stripeClient from "@/lib/stripe/client";
import type { WEBHOOK_CREATED_BY } from "@/lib/stripe/checkout/webhookCreatedBy";

/**
 * Writes `accountId` onto the subscription (what `getActiveSubscriptions`
 * matches) and the customer (what portal and payment-method lookups match).
 * `createdBy` is `stripe_webhook` when the account was minted for the
 * billing email and has never signed in, which is what lets a later claim
 * from a different sign-in email take the subscription over; an empty
 * string clears it.
 */
export async function stampSubscriptionAccount(args: {
  subscriptionId: string;
  customerId: string;
  accountId: string;
  createdBy: typeof WEBHOOK_CREATED_BY | "";
}): Promise<void> {
  const { subscriptionId, customerId, accountId, createdBy } = args;
  await stripeClient.subscriptions.update(subscriptionId, {
    metadata: { accountId, created_by: createdBy },
  });
  await stripeClient.customers.update(customerId, { metadata: { accountId } });
}
