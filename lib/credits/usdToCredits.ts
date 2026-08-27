import { CREDITS_PER_USD } from "@/lib/credits/creditsPerUsd";

/**
 * Credits for a dollar amount, in whole ledger units.
 *
 * Two rules, decided on recoupable/app#2000 (2026-08-27):
 * - No rounding up. The ledger unit is the precision; a residue below one
 *   unit is absorbed by Recoup, never charged. The product is settled to six
 *   decimals first so IEEE-754 noise (0.12 * 100 = 11.999…) cannot floor a
 *   whole-unit amount down by one.
 * - Minimum one unit. A request that reached a model is never free, even
 *   when the gateway reports no cost; after the rescale that floor is one
 *   micro-dollar. Callers that genuinely want zero for zero (music, where a
 *   failed generation costs nothing) decide that before calling.
 *
 * @param usd - Cost in dollars.
 * @returns Whole credits, minimum 1.
 */
export function usdToCredits(usd: number): number {
  const units = Number((usd * CREDITS_PER_USD).toFixed(6));
  return Math.max(1, Math.floor(units));
}
