import { adjustCreditBalanceAtomic } from "@/lib/supabase/credits_usage/adjustCreditBalanceAtomic";

interface DeductCreditsParams {
  accountId: string;
  creditsToDeduct: number;
}

interface DeductCreditsResult {
  success: boolean;
  newBalance?: number;
  message?: string;
}

/**
 * Deducts credits from an account's credit balance.
 *
 * @param params - The parameters for deducting credits.
 * @param params.accountId - The account ID to deduct credits from.
 * @param params.creditsToDeduct - The number of credits to deduct.
 * @returns Result object indicating success/failure and new balance.
 * @throws Error if the account doesn't have sufficient credits.
 */
export const deductCredits = async ({
  accountId,
  creditsToDeduct,
}: DeductCreditsParams): Promise<DeductCreditsResult> => {
  if (!Number.isSafeInteger(creditsToDeduct) || creditsToDeduct < 0)
    throw new Error("creditsToDeduct must be a non-negative integer");
  const row = await adjustCreditBalanceAtomic(accountId, -creditsToDeduct);
  return { success: true, newBalance: row.remaining_credits };
};
