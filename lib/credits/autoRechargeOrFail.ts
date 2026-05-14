import { selectCreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";
import { incrementRemainingCredits } from "@/lib/supabase/credits_usage/incrementRemainingCredits";
import { resolveStripeCustomerForAccount } from "@/lib/stripe/resolveStripeCustomerForAccount";
import {
  chargeCustomerOffSession,
  type DeclineReason,
} from "@/lib/stripe/chargeCustomerOffSession";
import { createCreditsStripeSession } from "@/lib/stripe/createCreditsStripeSession";
import { computeCreditsTopupCharge } from "@/lib/stripe/computeCreditsTopupCharge";
import { CREDIT_AUTO_RECHARGE_CREDITS, CREDIT_AUTO_RECHARGE_PURPOSE } from "@/lib/credits/const";

export type AutoRechargeOrFailParams = {
  accountId: string;
  creditsToDeduct: number;
  successUrl: string;
};

export type AutoRechargeOrFailResult =
  | { kind: "available" }
  | {
      kind: "insufficient_credits";
      remainingCredits: number;
      requiredCredits: number;
      checkoutUrl: string;
      declineReason?: DeclineReason;
    };

/**
 * Just-in-time credit gate. If the account's `remaining_credits` covers
 * `creditsToDeduct`, returns `{ kind: "available" }` and the caller proceeds.
 * Otherwise attempts a silent $5 off-session top-up against the saved card;
 * if that succeeds, increments credits in-thread (the webhook ignores PIs
 * stamped `purpose === "credits_auto_recharge"`) and returns "available".
 *
 * Does **not** deduct — that stays with the caller, so the existing pattern
 * of "do the work first, deduct on success" survives. On no-card / decline,
 * returns `{ kind: "insufficient_credits", checkoutUrl, declineReason? }`.
 */
export async function autoRechargeOrFail(
  params: AutoRechargeOrFailParams,
): Promise<AutoRechargeOrFailResult> {
  const { accountId, creditsToDeduct, successUrl } = params;

  const rows = await selectCreditsUsage({ account_id: accountId });
  const remaining = rows?.[0]?.remaining_credits ?? 0;

  if (remaining >= creditsToDeduct) return { kind: "available" };

  const customer = await resolveStripeCustomerForAccount(accountId);
  const { totalCents } = computeCreditsTopupCharge(CREDIT_AUTO_RECHARGE_CREDITS);

  const charge = await chargeCustomerOffSession({
    customer,
    totalCents,
    metadata: {
      accountId,
      credits: String(CREDIT_AUTO_RECHARGE_CREDITS),
      purpose: CREDIT_AUTO_RECHARGE_PURPOSE,
    },
  });

  // If Stripe charged the card, credits MUST be applied — otherwise the
  // customer paid for credits that never landed. Apply unconditionally;
  // whether the topup *alone* covers this request is a separate question.
  if (charge.kind === "charged") {
    await incrementRemainingCredits({ accountId, delta: CREDIT_AUTO_RECHARGE_CREDITS });
    if (remaining + CREDIT_AUTO_RECHARGE_CREDITS >= creditsToDeduct) {
      return { kind: "available" };
    }
  }

  const session = await createCreditsStripeSession({
    accountId,
    credits: CREDIT_AUTO_RECHARGE_CREDITS,
    successUrl,
    customer,
  });
  if (!session.url) {
    throw new Error(
      `[autoRechargeOrFail] createCreditsStripeSession returned no url for account ${accountId}`,
    );
  }

  return {
    kind: "insufficient_credits",
    remainingCredits:
      charge.kind === "charged" ? remaining + CREDIT_AUTO_RECHARGE_CREDITS : remaining,
    requiredCredits: creditsToDeduct,
    checkoutUrl: session.url,
    ...(charge.kind === "requires_action" && charge.declineReason
      ? { declineReason: charge.declineReason }
      : {}),
  };
}
