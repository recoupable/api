import {
  selectCreditsUsage,
  type CreditsUsage,
} from "@/lib/supabase/credits_usage/selectCreditsUsage";
import { updateCreditsUsage } from "@/lib/supabase/credits_usage/updateCreditsUsage";
import isActiveSubscription from "@/lib/stripe/isActiveSubscription";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { getOrgSubscription } from "@/lib/stripe/getOrgSubscription";
import { DEFAULT_CREDITS, PRO_CREDITS } from "@/lib/credits/const";

export interface CheckAndResetCreditsResult {
  creditsUsage: CreditsUsage | null;
  isPro: boolean;
}

/**
 * Reads the credits_usage row for an account and, if a monthly refill is due
 * (≥1 month since the last update, or an active subscription started after it),
 * refills `remaining_credits` to the plan total and bumps the timestamp.
 *
 * Also returns `isPro` so callers don't need to repeat the subscription lookup.
 */
export async function checkAndResetCredits(accountId: string): Promise<CheckAndResetCreditsResult> {
  const [rows, accountSub, orgSub] = await Promise.all([
    selectCreditsUsage({ account_id: accountId }),
    getActiveSubscriptionDetails(accountId),
    getOrgSubscription(accountId),
  ]);

  const hasAccountSub = isActiveSubscription(accountSub);
  const hasOrgSub = isActiveSubscription(orgSub);
  const isPro = hasAccountSub || hasOrgSub;

  if (!rows || rows.length === 0) {
    return { creditsUsage: null, isPro };
  }

  const creditsUsage = rows[0];

  if (!creditsUsage.timestamp) {
    return { creditsUsage, isPro };
  }

  const lastUpdated = new Date(creditsUsage.timestamp);
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const activeSub = hasAccountSub ? accountSub : hasOrgSub ? orgSub : null;
  const subscriptionStartUnix = activeSub?.current_period_start ?? activeSub?.start_date ?? null;
  const subscriptionStart = subscriptionStartUnix ? new Date(subscriptionStartUnix * 1000) : null;

  const isMonthlyRefill = lastUpdated < oneMonthAgo;
  const isSubscriptionStartedAfterLastUpdate =
    subscriptionStart !== null && lastUpdated < subscriptionStart;
  const shouldRefill = isMonthlyRefill || isSubscriptionStartedAfterLastUpdate;

  if (!shouldRefill) {
    return { creditsUsage, isPro };
  }

  const refilled = await updateCreditsUsage({
    account_id: accountId,
    updates: {
      remaining_credits: isPro ? PRO_CREDITS : DEFAULT_CREDITS,
      timestamp: new Date().toISOString(),
    },
  });

  return { creditsUsage: refilled, isPro };
}
