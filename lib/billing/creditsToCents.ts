import { CREDIT_DECIMALS } from "@/lib/credits/creditDecimals";

const CREDITS_PER_CENT = 10 ** (CREDIT_DECIMALS - 2);

/**
 * Credit micro-dollars to whole cents, flooring any partial cent. Null passes
 * through so unset settings stay null in the API response.
 */
export function creditsToCents(credits: number | null): number | null {
  if (credits === null) return null;
  return Math.floor(credits / CREDITS_PER_CENT);
}
