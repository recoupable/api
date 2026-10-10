import {
  selectCreditsUsage,
  type CreditsUsage,
} from "@/lib/supabase/credits_usage/selectCreditsUsage";
import { refillCreditsToFloor } from "@/lib/supabase/credits_usage/refillCreditsToFloor";
import { getAccountSubscriptionState } from "@/lib/credits/getAccountSubscriptionState";
import { usdToCredits } from "@/lib/credits/usdToCredits";
import { getPlanEntitlements } from "@/lib/plans/getPlanEntitlements";
import { initializeAccountCredits } from "@/lib/credits/initializeAccountCredits";
import type { Plan } from "@/lib/plans/types";

export interface CheckAndResetCreditsResult {
  creditsUsage: CreditsUsage | null;
  plan: Plan;
}

/**
 * Reads the credits_usage row for an account, seeding one with the plan's
 * allotment when none exists yet (an org that has never spent), and, if a monthly refill is due
 * (≥1 month since the last update, or an active subscription started after it),
 * raises `remaining_credits` up to the plan total and bumps the timestamp.
 *
 * The refill is a **floor, not an assignment**: it never lowers a balance, so
 * a top-up or an admin grant above the plan total survives every refill
 * without the read path needing to know where the balance came from. The
 * floor is applied by the database under the wallet row lock, never from the
 * balance read here, so a concurrent deduction, top-up or grant is neither
 * resurrected nor dropped.
 *
 * Also returns `plan` so callers don't need to repeat the subscription lookup.
 */
export async function checkAndResetCredits(accountId: string): Promise<CheckAndResetCreditsResult> {
  const [rows, { plan, activeSubscription }] = await Promise.all([
    selectCreditsUsage({ account_id: accountId }),
    getAccountSubscriptionState(accountId),
  ]);

  if (!rows || rows.length === 0) {
    // A fresh row needs no refill. If two first reads race, the loser reads the winner's row.
    const seeded =
      (await initializeAccountCredits(accountId)) ??
      (await selectCreditsUsage({ account_id: accountId }))?.[0] ??
      null;
    return { creditsUsage: seeded, plan };
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

  // One locked statement raises the balance to the plan total with GREATEST and
  // advances the timestamp on every due refill, including the no-op ones —
  // otherwise the account re-evaluates as refill-due on every subsequent read.
  const refilled = await refillCreditsToFloor({ accountId, floor: planTotal });

  return {
    creditsUsage: {
      ...creditsUsage,
      remaining_credits: refilled.remainingCredits,
      timestamp: refilled.timestamp,
    },
    plan,
  };
}
