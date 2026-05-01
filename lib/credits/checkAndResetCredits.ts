import { selectCreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";
import { updateCreditsUsage } from "@/lib/supabase/credits_usage/updateCreditsUsage";
import type { CreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";
import isActiveSubscription from "@/lib/stripe/isActiveSubscription";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { getOrgSubscription } from "@/lib/stripe/getOrgSubscription";

export const CHECK_AND_RESET_DEFAULT_CREDITS = 333;
export const CHECK_AND_RESET_PRO_CREDITS = 1000;

/**
 * Returns the credits row for the given account, refilling it when the
 * account is on a refill cycle (monthly cadence or just-activated
 * subscription). Honors both account-level and organization-level Stripe
 * subscriptions when deciding whether the refill should use the pro tier.
 */
export const checkAndResetCredits = async (accountId: string): Promise<CreditsUsage | null> => {
  const found = await selectCreditsUsage({ account_id: accountId });
  if (!found || found.length === 0) return null;

  const creditsUsage = found[0];
  if (!creditsUsage.timestamp) return creditsUsage;

  const lastUpdatedCredits = new Date(creditsUsage.timestamp);
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const accountSubscription = await getActiveSubscriptionDetails(accountId);
  const orgSubscription = await getOrgSubscription(accountId);

  const hasAccountSubscription = isActiveSubscription(accountSubscription);
  const hasOrgSubscription = isActiveSubscription(orgSubscription);
  const isPro = hasAccountSubscription || hasOrgSubscription;

  const activeSubscription = hasAccountSubscription
    ? accountSubscription
    : hasOrgSubscription
      ? orgSubscription
      : null;
  const subscriptionStartUnix =
    activeSubscription?.current_period_start ?? activeSubscription?.start_date;
  const isMonthlyRefill = lastUpdatedCredits < oneMonthAgo;
  const hasActiveSubscription = isPro && subscriptionStartUnix;
  const subscriptionStart = hasActiveSubscription ? new Date(subscriptionStartUnix * 1000) : null;
  const isSubscriptionStartedAfterLastUpdate =
    subscriptionStart && lastUpdatedCredits < subscriptionStart;
  const isRefill = isMonthlyRefill || isSubscriptionStartedAfterLastUpdate;
  if (!isRefill) return creditsUsage;

  return updateCreditsUsage({
    account_id: accountId,
    updates: {
      remaining_credits: isPro ? CHECK_AND_RESET_PRO_CREDITS : CHECK_AND_RESET_DEFAULT_CREDITS,
      timestamp: new Date().toISOString(),
    },
  });
};
