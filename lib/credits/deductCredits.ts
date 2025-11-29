import { selectCreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";
import { updateCreditsUsage } from "@/lib/supabase/credits_usage/updateCreditsUsage";

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
  const response = await selectCreditsUsage({ account_id: accountId });

  if (!response || response.length === 0) {
    throw new Error("No credits usage found for this account");
  }

  const currentCredits = response[0];
  const currentBalance = currentCredits.remaining_credits;

  if (currentBalance < creditsToDeduct) {
    throw new Error(
      `Insufficient credits. Required: ${creditsToDeduct}, Available: ${currentBalance}`,
    );
  }

  const newBalance = currentBalance - creditsToDeduct;

  await updateCreditsUsage({
    account_id: accountId,
    updates: {
      remaining_credits: newBalance,
    },
  });

  return {
    success: true,
    newBalance,
  };
};
