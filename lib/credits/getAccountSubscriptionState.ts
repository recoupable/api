import type Stripe from "stripe";
import isActiveSubscription from "@/lib/stripe/isActiveSubscription";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { getOrgSubscription } from "@/lib/stripe/getOrgSubscription";
import { isEnterpriseAccount } from "@/lib/enterprise/isEnterpriseAccount";

export interface AccountSubscriptionState {
  isPro: boolean;
  activeSubscription: Stripe.Subscription | null;
}

/**
 * Single source of truth for "what's this account's plan?" — checks the
 * account-level subscription, any org membership, and enterprise email-domain
 * status in parallel. `isPro` is true if any of the three match; the active
 * subscription resolves with account-wins-on-tie precedence.
 *
 * `activeSubscription` stays Stripe-only on purpose: it feeds
 * checkAndResetCredits's early-refill via `current_period_start`, and
 * enterprise-domain accounts (no Stripe sub) must refill on the ≥1-month path
 * only — so an enterprise match yields `isPro: true, activeSubscription: null`.
 */
export async function getAccountSubscriptionState(
  accountId: string,
): Promise<AccountSubscriptionState> {
  const [accountSub, orgSub, isEnterprise] = await Promise.all([
    getActiveSubscriptionDetails(accountId),
    getOrgSubscription(accountId),
    isEnterpriseAccount(accountId),
  ]);
  const hasAccountSub = isActiveSubscription(accountSub);
  const hasOrgSub = isActiveSubscription(orgSub);
  return {
    isPro: hasAccountSub || hasOrgSub || isEnterprise,
    activeSubscription: hasAccountSub ? accountSub : hasOrgSub ? orgSub : null,
  };
}
