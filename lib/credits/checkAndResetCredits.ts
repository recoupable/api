import {
  selectCreditsUsage,
  type CreditsUsage,
} from "@/lib/supabase/credits_usage/selectCreditsUsage";
import { updateCreditsUsage } from "@/lib/supabase/credits_usage/updateCreditsUsage";
import { getAccountSubscriptionState } from "@/lib/credits/getAccountSubscriptionState";
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
  const [rows, { isPro, activeSubscription }] = await Promise.all([
    selectCreditsUsage({ account_id: accountId }),
    getAccountSubscriptionState(accountId),
  ]);

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

  const subscriptionStartUnix =
    activeSubscription?.current_period_start ?? activeSubscription?.start_date ?? null;
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
