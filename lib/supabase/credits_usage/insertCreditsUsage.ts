import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Inserts a new credits_usage record for an account at the supplied balance.
 *
 * This is the low-level DB op. Callers should not invoke it directly with a
 * hard-coded number — go through `lib/credits/initializeAccountCredits` so the
 * plan-aware DEFAULT_CREDITS / PRO_CREDITS choice stays in one place.
 *
 * @param accountId - The account ID to initialize credits for
 * @param remainingCredits - Initial balance (caller decides — no default)
 * @param timestamp - Optional explicit `timestamp` (ISO string). The monthly
 *   reset measures staleness from this column, so a caller that needs the
 *   refill clock to start at a known moment — an admin grant, which reports an
 *   expiry back to the operator — sets it rather than trusting a column
 *   default. Omitted when absent, leaving prior behaviour untouched.
 * @returns The inserted credits_usage record, or null if failed
 */
export async function insertCreditsUsage(
  accountId: string,
  remainingCredits: number,
  timestamp?: string,
): Promise<Tables<"credits_usage"> | null> {
  const { data, error } = await supabase
    .from("credits_usage")
    .insert({
      account_id: accountId,
      remaining_credits: remainingCredits,
      ...(timestamp ? { timestamp } : {}),
    })
    .select("*")
    .single();

  if (error) {
    console.error("[ERROR] insertCreditsUsage:", error);
    return null;
  }

  return data || null;
}
