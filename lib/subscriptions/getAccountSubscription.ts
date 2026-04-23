import Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { isEnterprise } from "@/lib/enterprise/isEnterprise";

export type AccountSubscription =
  | { isEnterprise: true }
  | { subscription: Stripe.Subscription }
  | null;

/**
 * Resolves an account's subscription state: enterprise (via email domain),
 * an active Stripe subscription (`metadata.accountId` match), or null.
 *
 * Uses `stripe.subscriptions.search` so the metadata + status filter runs on
 * Stripe's side — scales independently of total subscription count (a prior
 * `list({ limit: 100 })` + client-side filter was lossy past 100). Search is
 * eventually consistent (~1 min lag after writes).
 */
export async function getAccountSubscription(accountId: string): Promise<AccountSubscription> {
  try {
    const emails = await selectAccountEmails({ accountIds: accountId });
    if (emails.some(record => isEnterprise(record.email || ""))) {
      return { isEnterprise: true };
    }

    const result = await stripeClient.subscriptions.search({
      query: `status:"active" AND metadata["accountId"]:"${accountId}"`,
      limit: 1,
    });
    const subscription = result.data[0];
    return subscription ? { subscription } : null;
  } catch (error) {
    console.error("[ERROR] getAccountSubscription:", error);
    return null;
  }
}
