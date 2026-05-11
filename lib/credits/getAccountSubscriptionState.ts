import type Stripe from "stripe";
import isActiveSubscription from "@/lib/stripe/isActiveSubscription";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { getOrgSubscription } from "@/lib/stripe/getOrgSubscription";

export interface AccountSubscriptionState {
  isPro: boolean;
  activeSubscription: Stripe.Subscription | null;
}

/**
 * Single source of truth for "what's this account's plan?" — checks both the
 * account-level subscription and any org membership in parallel, then resolves
 * the active subscription with account-wins-on-tie precedence.
 *
 * Returns the resolved Stripe.Subscription alongside the boolean so callers
 * that need period-start timestamps (e.g. checkAndResetCredits) don't have to
 * re-derive which one was active.
 */
export async function getAccountSubscriptionState(
  accountId: string,
): Promise<AccountSubscriptionState> {
  const [accountSub, orgSub] = await Promise.all([
    getActiveSubscriptionDetails(accountId),
    getOrgSubscription(accountId),
  ]);
  const hasAccountSub = isActiveSubscription(accountSub);
  const hasOrgSub = isActiveSubscription(orgSub);
  return {
    isPro: hasAccountSub || hasOrgSub,
    activeSubscription: hasAccountSub ? accountSub : hasOrgSub ? orgSub : null,
  };
}
