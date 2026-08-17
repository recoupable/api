import { selectCreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";
import { resolveStripeCustomerForAccount } from "@/lib/stripe/resolveStripeCustomerForAccount";
import { createCreditsStripeSession } from "@/lib/stripe/createCreditsStripeSession";
import { CREDIT_SHORTFALL_TOPUP_CREDITS } from "@/lib/credits/const";

export type CheckCreditsAvailableParams = {
  accountId: string;
  creditsToDeduct: number;
  successUrl: string;
};

export type CheckCreditsAvailableResult =
  | { kind: "available" }
  | {
      kind: "insufficient_credits";
      remainingCredits: number;
      requiredCredits: number;
      checkoutUrl: string;
    };

/**
 * Just-in-time credit gate. Reports whether the account's `remaining_credits`
 * covers `creditsToDeduct`. It never charges a card; buying credits happens
 * only where the account asks for it, at `POST /api/credits/sessions`.
 *
 * Not read-only on a shortfall, though: it resolves the Stripe customer
 * (created on first touch) and mints the Checkout Session behind the 402's
 * `checkoutUrl`.
 *
 * Does **not** deduct either; that stays with the caller, so the existing
 * pattern of "do the work first, deduct on success" survives.
 */
export async function checkCreditsAvailable(
  params: CheckCreditsAvailableParams,
): Promise<CheckCreditsAvailableResult> {
  const { accountId, creditsToDeduct, successUrl } = params;

  const rows = await selectCreditsUsage({ account_id: accountId });
  const remaining = rows?.[0]?.remaining_credits ?? 0;

  if (remaining >= creditsToDeduct) return { kind: "available" };

  const customer = await resolveStripeCustomerForAccount(accountId);
  const session = await createCreditsStripeSession({
    accountId,
    credits: CREDIT_SHORTFALL_TOPUP_CREDITS,
    successUrl,
    customer,
  });
  if (!session.url) {
    throw new Error(
      `[checkCreditsAvailable] createCreditsStripeSession returned no url for account ${accountId}`,
    );
  }

  return {
    kind: "insufficient_credits",
    remainingCredits: remaining,
    requiredCredits: creditsToDeduct,
    checkoutUrl: session.url,
  };
}
