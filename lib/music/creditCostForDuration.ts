import { usdToCredits } from "@/lib/credits/usdToCredits";

/**
 * What fal charges per second of MiniMax Music 3 output, in dollars.
 *
 * The provider's own rate, stated in the provider's own unit. Music is priced
 * as a pass-through, so this is both our cost and our price
 * (recoupable/chat#1999).
 */
export const FAL_MUSIC_USD_PER_SECOND = 0.002;

/**
 * Credits to charge for a music generation: the fal rate through
 * `usdToCredits`, so at the micro-dollar unit a 25.87 s song is exactly
 * 51,740 credits ($0.05174).
 *
 * No floor. A minimum charge cannot coexist with pass-through pricing; we
 * absorb the workflow run, the storage write and the egress instead. Zero for
 * a non-positive duration, decided here because `usdToCredits` itself never
 * returns less than one unit.
 *
 * @param seconds - Duration to price. The caller decides whether this is the
 *   requested duration (for the pre-flight gate) or the actual output length
 *   (for the deduction).
 * @returns Whole credits.
 */
export function creditCostForDuration(seconds: number): number {
  if (seconds <= 0) return 0;

  return usdToCredits(seconds * FAL_MUSIC_USD_PER_SECOND);
}
