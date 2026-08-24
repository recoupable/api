import { usdToCreditsAtLeastCost } from "@/lib/credits/creditUnit";

/**
 * What fal charges per second of MiniMax Music 3 output, in dollars.
 *
 * The provider's own rate, stated in the provider's own unit. Music is priced
 * as a pass-through, so this is both our cost and our price
 * (recoupable/chat#1999).
 */
export const FAL_MUSIC_USD_PER_SECOND = 0.002;

/**
 * Credits to charge for a music generation.
 *
 * Cost in dollars first, credits second. Expressing the rate as $0.002/s and
 * converting through the credit unit means the price tracks fal rather than
 * the ledger: when a credit becomes a micro-dollar (chat#2000) this function
 * needs no change, and the rounding below simply gets four decimal places
 * finer.
 *
 * The previous form hardcoded 0.2 credits per second, which is the same number
 * only for as long as a credit is a cent.
 *
 * No floor. The old 15-credit minimum made a 10-second song $0.15 against
 * $0.02 of cost — 7.5x — which cannot coexist with pass-through pricing. We
 * absorb the workflow run, the storage write and the egress instead.
 *
 * Rounds up rather than to nearest: this is a pass-through price, so rounding
 * down would mean paying fal the difference. At today's cent-sized credit one
 * credit buys five seconds, so a duration that is not a multiple of five costs
 * under a cent more than it should; at a micro-dollar that disappears.
 *
 * @param seconds - Duration to price. The caller decides whether this is the
 *   requested duration (for the pre-flight gate) or the actual output length
 *   (for the deduction).
 * @returns Whole credits.
 */
export function creditCostForDuration(seconds: number): number {
  if (seconds <= 0) return 0;

  return usdToCreditsAtLeastCost(seconds * FAL_MUSIC_USD_PER_SECOND);
}
