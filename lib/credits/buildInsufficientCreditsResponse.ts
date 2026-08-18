import { CREDIT_BILLING_URL } from "@/lib/credits/const";

export type InsufficientCreditsBody = {
  error: "insufficient_credits";
  remaining_credits: number;
  required_credits: number;
  billingUrl: string;
};

/**
 * Shapes the 402 Payment Required body for credit-gated endpoints.
 *
 * `billingUrl` is a constant, not a minted Stripe Checkout Session: a
 * scheduled task that runs out of credits gets the same static link back
 * forever and creates nothing.
 *
 * Deliberately *not* the same shape as the `POST /api/credits/sessions`
 * response, which is `{ id, url, declineReason? }` and does mint a session.
 */
export function buildInsufficientCreditsResponse(args: {
  remainingCredits: number;
  requiredCredits: number;
}): InsufficientCreditsBody {
  const { remainingCredits, requiredCredits } = args;
  return {
    error: "insufficient_credits",
    remaining_credits: remainingCredits,
    required_credits: requiredCredits,
    billingUrl: CREDIT_BILLING_URL,
  };
}
