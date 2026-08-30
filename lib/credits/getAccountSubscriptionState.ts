import type Stripe from "stripe";
import isActiveSubscription from "@/lib/stripe/isActiveSubscription";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { getOrgSubscription } from "@/lib/stripe/getOrgSubscription";
import { isEnterpriseAccount } from "@/lib/enterprise/isEnterpriseAccount";
import { resolvePlan } from "@/lib/plans/resolvePlan";
import type { Plan } from "@/lib/plans/types";

export interface AccountSubscriptionState {
  /** True only on Pro: Starter keeps the free-tier gates on roster scrape, recipients, and API keys. */
  isPro: boolean;
  plan: Plan;
  activeSubscription: Stripe.Subscription | null;
}

/**
 * Single source of truth for "what's this account's plan?" — checks the
 * account-level subscription, any org membership, and enterprise email-domain
 * status in parallel. `plan` comes from `resolvePlan` (Starter price, any other
 * paid source, or nothing); `isPro` is `plan === "pro"`; `activeSubscription`
 * prefers the Stripe sub that confers the plan (org Pro over a Starter account).
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
  const plan = resolvePlan({ accountSub, orgSub, isEnterprise });
  // Prefer the Stripe sub that confers the plan so refill timing follows the
  // Pro org when a Starter account is also active.
  const accountAlone = resolvePlan({
    accountSub,
    orgSub: null,
    isEnterprise: false,
  });
  const activeSubscription =
    plan === "pro" && accountAlone !== "pro" && hasOrgSub
      ? orgSub
      : hasAccountSub
        ? accountSub
        : hasOrgSub
          ? orgSub
          : null;
  return {
    isPro: plan === "pro",
    plan,
    activeSubscription,
  };
}
