import { CREDIT_DECIMALS } from "@/lib/credits/creditDecimals";

const CREDITS_PER_CENT = 10 ** (CREDIT_DECIMALS - 2);

/**
 * Cents to credit micro-dollars: the unit `credits_usage` stores.
 * 1 cent = 10,000 credits at CREDIT_DECIMALS = 6.
 */
export function centsToCredits(cents: number): number {
  return cents * CREDITS_PER_CENT;
}
