import { parseUnits } from "viem";
import { CREDIT_DECIMALS } from "@/lib/credits/creditDecimals";

/**
 * Credits for a dollar amount, in whole ledger units: viem's `parseUnits` at
 * the credit precision, floored at one unit.
 *
 * `parseUnits` takes a decimal string, and `String(usd)` switches to exponent
 * notation below 1e-6 (`"1e-7"`), which it rejects; `toFixed` always yields
 * fixed notation, rounded to the nearest unit.
 *
 * The one-unit floor is the minimum charge decided on recoupable/app#2000
 * (2026-08-27): a request that reached a model is never free. Callers that
 * want zero for zero (music, where a failed generation costs nothing) decide
 * that before calling.
 *
 * @param usd - Cost in dollars.
 * @returns Whole credits, minimum 1.
 */
export function usdToCredits(usd: number): number {
  return Math.max(1, Number(parseUnits(usd.toFixed(CREDIT_DECIMALS), CREDIT_DECIMALS)));
}
