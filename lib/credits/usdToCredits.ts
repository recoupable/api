import { parseUnits } from "viem";
import { CREDIT_DECIMALS } from "@/lib/credits/creditDecimals";

/**
 * Credits for a dollar amount, in whole ledger units.
 *
 * Two rules, decided on recoupable/app#2000 (2026-08-27):
 * - No rounding up. The dollar figure is truncated to `CREDIT_DECIMALS`
 *   before `parseUnits` (which would otherwise round half up), so a residue
 *   below one unit is absorbed by Recoup, never charged. Going through a
 *   decimal string also sidesteps IEEE-754 noise (0.12 * 1e6 = 119999.99…).
 * - Minimum one unit. A request that reached a model is never free, even
 *   when the gateway reports no cost. Callers that genuinely want zero for
 *   zero (music, where a failed generation costs nothing) decide that before
 *   calling.
 *
 * @param usd - Cost in dollars.
 * @returns Whole credits, minimum 1.
 */
export function usdToCredits(usd: number): number {
  const [whole, fraction = ""] = usd.toFixed(CREDIT_DECIMALS + 2).split(".");
  const truncated = `${whole}.${fraction.slice(0, CREDIT_DECIMALS)}`;
  return Math.max(1, Number(parseUnits(truncated, CREDIT_DECIMALS)));
}
