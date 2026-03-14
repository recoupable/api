import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/** Default credits for free tier accounts */
const DEFAULT_CREDITS = 25;

/**
 * Inserts a new credits_usage record for an account.
 * Initializes with default credits.
 *
 * @param accountId - The account ID to initialize credits for
 * @param remainingCredits - Optional override for initial credits (defaults to 25)
 * @returns The inserted credits_usage record, or null if failed
 */
export async function insertCreditsUsage(
  accountId: string,
  remainingCredits: number = DEFAULT_CREDITS,
): Promise<Tables<"credits_usage"> | null> {
  const { data, error } = await supabase
    .from("credits_usage")
    .insert({
      account_id: accountId,
      remaining_credits: remainingCredits,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[ERROR] insertCreditsUsage:", error);
    return null;
  }

  return data || null;
}
