import {
  selectCreditsUsage,
  type CreditsUsage,
} from "@/lib/supabase/credits_usage/selectCreditsUsage";
import { updateCreditsUsage } from "@/lib/supabase/credits_usage/updateCreditsUsage";
import { getAccountSubscriptionState } from "@/lib/credits/getAccountSubscriptionState";
import { usdToCredits } from "@/lib/credits/usdToCredits";
import { getPlanEntitlements } from "@/lib/plans/getPlanEntitlements";
import type { Plan } from "@/lib/plans/types";

export interface CheckAndResetCreditsResult {
  creditsUsage: CreditsUsage | null;
  plan: Plan;
}

/**
 * Reads the credits_usage row for an account and, if a monthly refill is due
 * (≥1 month since the last update, or an active subscription started after it),
 * raises `remaining_credits` up to the plan total and bumps the timestamp.
 *
 * The refill is a **floor, not an assignment**: it never lowers a balance, so
 * a top-up or an admin grant above the plan total survives every refill
 * without the read path needing to know where the balance came from.
 *
 * Also returns `plan` so callers don't need to repeat the subscription lookup.
 */
export async function checkAndResetCredits(accountId: string): Promise<CheckAndResetCreditsResult> {
  const [rows, { plan, activeSubscription }] = await Promise.all([
    selectCreditsUsage({ account_id: accountId }),
    getAccountSubscriptionState(accountId),
  ]);

  if (!rows || rows.length === 0) {
    return { creditsUsage: null, plan };
  }

  const creditsUsage = rows[0];

  if (!creditsUsage.timestamp) {
    return { creditsUsage, plan };
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
    return { creditsUsage, plan };
  }

  const planTotal = usdToCredits(getPlanEntitlements(plan).credits_usd);
  const remaining = creditsUsage.remaining_credits ?? 0;

  // The timestamp advances on every due refill, including the no-op ones —
  // otherwise the account re-evaluates as refill-due on every subsequent read.
  // `remaining_credits` is omitted rather than written back as `max(remaining,
  // planTotal)` when the balance already clears the total: writing a value read
  // moments earlier would resurrect credits a concurrent deduction had spent.
  const updates: Partial<Pick<CreditsUsage, "remaining_credits" | "timestamp">> = {
    timestamp: new Date().toISOString(),
  };
  if (remaining < planTotal) updates.remaining_credits = planTotal;

  const refilled = await updateCreditsUsage({ account_id: accountId, updates });

  return { creditsUsage: refilled, plan };
}
