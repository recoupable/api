import { selectCreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";

export type CheckCreditsAvailableParams = {
  accountId: string;
  creditsToDeduct: number;
};

export type CheckCreditsAvailableResult =
  | { kind: "available" }
  | {
      kind: "insufficient_credits";
      remainingCredits: number;
      requiredCredits: number;
    };

/**
 * Just-in-time credit gate. Reports whether the account's `remaining_credits`
 * covers `creditsToDeduct`. It reads, and does nothing else: no charge, and no
 * Stripe object created as a side effect of a failed authorization.
 *
 * Does **not** deduct either; that stays with the caller, so the existing
 * pattern of "do the work first, deduct on success" survives.
 *
 * The recovery link on the 402 is a constant supplied by
 * `buildInsufficientCreditsResponse`. A real Checkout Session is minted only
 * when someone asks to buy credits, at `POST /api/credits/sessions`.
 */
export async function checkCreditsAvailable(
  params: CheckCreditsAvailableParams,
): Promise<CheckCreditsAvailableResult> {
  const { accountId, creditsToDeduct } = params;

  const rows = await selectCreditsUsage({ account_id: accountId });
  const remaining = rows?.[0]?.remaining_credits ?? 0;

  if (remaining >= creditsToDeduct) return { kind: "available" };

  return {
    kind: "insufficient_credits",
    remainingCredits: remaining,
    requiredCredits: creditsToDeduct,
  };
}
