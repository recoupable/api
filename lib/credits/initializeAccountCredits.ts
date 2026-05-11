import type { Tables } from "@/types/database.types";
import { insertCreditsUsage } from "@/lib/supabase/credits_usage/insertCreditsUsage";
import { getAccountSubscriptionState } from "@/lib/credits/getAccountSubscriptionState";
import { DEFAULT_CREDITS, PRO_CREDITS } from "@/lib/credits/const";

/**
 * Seeds a brand-new `credits_usage` row for an account with the plan-aware
 * starting balance: `PRO_CREDITS` if the account (or an org they belong to)
 * already has an active Stripe subscription, otherwise `DEFAULT_CREDITS`.
 *
 * Use this from any account-creation path. Do not call `insertCreditsUsage`
 * directly with a hard-coded number — let this function pick the right value.
 */
export async function initializeAccountCredits(
  accountId: string,
): Promise<Tables<"credits_usage"> | null> {
  const { isPro } = await getAccountSubscriptionState(accountId);
  return insertCreditsUsage(accountId, isPro ? PRO_CREDITS : DEFAULT_CREDITS);
}
