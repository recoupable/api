import type { DeclineReason } from "@/lib/stripe/chargeCustomerOffSession";

export type InsufficientCreditsBody = {
  error: "insufficient_credits";
  remaining_credits: number;
  required_credits: number;
  checkoutUrl: string;
  declineReason?: DeclineReason;
};

/**
 * Shapes the 402 Payment Required body for credit-gated endpoints. Matches the
 * discriminated `{ id, url, declineReason? }` shape that open-agents' credits
 * dialog already parses — so a 402 with `declineReason` renders the decline
 * view, and one without renders the silent-Checkout-open path.
 */
export function buildInsufficientCreditsResponse(args: {
  remainingCredits: number;
  requiredCredits: number;
  checkoutUrl: string;
  declineReason?: DeclineReason;
}): InsufficientCreditsBody {
  const { remainingCredits, requiredCredits, checkoutUrl, declineReason } = args;
  return {
    error: "insufficient_credits",
    remaining_credits: remainingCredits,
    required_credits: requiredCredits,
    checkoutUrl,
    ...(declineReason ? { declineReason } : {}),
  };
}
