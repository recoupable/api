export type InsufficientCreditsBody = {
  error: "insufficient_credits";
  remaining_credits: number;
  required_credits: number;
  checkoutUrl: string;
};

/**
 * Shapes the 402 Payment Required body for credit-gated endpoints.
 *
 * Deliberately *not* the same shape as the `POST /api/credits/sessions`
 * response, which is `{ id, url, declineReason? }`. The two used to be
 * described as interchangeable, which is what invited `declineReason` onto this
 * envelope: it can only be produced by an off-session charge, and the credit
 * gate no longer makes one. `declineReason` stays on the top-up response, where
 * a real card decline still happens.
 */
export function buildInsufficientCreditsResponse(args: {
  remainingCredits: number;
  requiredCredits: number;
  checkoutUrl: string;
}): InsufficientCreditsBody {
  const { remainingCredits, requiredCredits, checkoutUrl } = args;
  return {
    error: "insufficient_credits",
    remaining_credits: remainingCredits,
    required_credits: requiredCredits,
    checkoutUrl,
  };
}
