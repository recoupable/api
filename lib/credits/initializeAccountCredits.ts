import type { Tables } from "@/types/database.types";
import { insertCreditsUsage } from "@/lib/supabase/credits_usage/insertCreditsUsage";
import { getAccountSubscriptionState } from "@/lib/credits/getAccountSubscriptionState";
import { usdToCredits } from "@/lib/credits/usdToCredits";
import { getPlanEntitlements } from "@/lib/plans/getPlanEntitlements";

/**
 * Seeds a brand-new `credits_usage` row for an account with the plan-aware
 * starting balance: the monthly allotment of whatever plan the account (or an
 * org they belong to) already resolves to, `DEFAULT_CREDITS` when none.
 *
 * Use this from any account-creation path. Do not call `insertCreditsUsage`
 * directly with a hard-coded number — let this function pick the right value.
 */
export async function initializeAccountCredits(
  accountId: string,
): Promise<Tables<"credits_usage"> | null> {
  const { plan } = await getAccountSubscriptionState(accountId);
  return insertCreditsUsage(accountId, usdToCredits(getPlanEntitlements(plan).credits_usd));
}
