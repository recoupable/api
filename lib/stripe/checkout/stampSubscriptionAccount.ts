import stripeClient from "@/lib/stripe/client";
import type { WEBHOOK_CREATED_BY } from "@/lib/stripe/checkout/webhookCreatedBy";

/**
 * Writes `accountId` onto the customer (what portal and payment-method
 * lookups match) and then the subscription (what `getActiveSubscriptions`
 * matches). The subscription goes last because its `accountId` is the
 * idempotency marker: a customer write that fails leaves nothing stamped,
 * so a webhook retry does the whole job again. `createdBy` is
 * `stripe_webhook` when the account was minted for the billing email and
 * has never signed in, which is what lets a later claim from a different
 * sign-in email take the subscription over; an empty string clears it.
 */
export async function stampSubscriptionAccount(args: {
  subscriptionId: string;
  customerId: string | null;
  accountId: string;
  createdBy: typeof WEBHOOK_CREATED_BY | "";
}): Promise<void> {
  const { subscriptionId, customerId, accountId, createdBy } = args;
  if (customerId) {
    await stripeClient.customers.update(customerId, { metadata: { accountId } });
  }
  await stripeClient.subscriptions.update(subscriptionId, {
    metadata: { accountId, created_by: createdBy },
  });
}
