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
 * response, which is `{ id, url, declineReason? }`. A decline can only come
 * from a charge, and only the top-up endpoint charges — so `declineReason`
 * belongs there, never on this envelope.
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
