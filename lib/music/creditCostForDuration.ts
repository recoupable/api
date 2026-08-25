/**
 * Credits per second of audio.
 *
 * fal charges $0.002 per output second and 1 credit is $0.01, so 0.2 credits
 * per second is fal's rate exactly — no markup (recoupable/chat#1999).
 */
const CREDITS_PER_SECOND = 0.2;

/**
 * Credits to charge for a music generation.
 *
 * Pass-through pricing: we are not reselling fal at a margin, so this returns
 * fal's own cost. A 60-second song is 12 credits, or $0.12, which is what fal
 * bills us for 60 seconds.
 *
 * No floor. The old 15-credit minimum made a 10-second song $0.15 against
 * $0.02 of cost — 7.5x — which cannot coexist with pass-through pricing. We
 * absorb the workflow run, the storage write and the egress instead.
 *
 * Rounds up because the ledger is integer cents: one credit buys exactly five
 * seconds at fal's rate, so durations that are not multiples of five round to
 * the next credit. The overcharge is at most $0.008 and is an artifact of the
 * unit, not a margin — chat#2000 proposes micro-dollar credits, which would
 * remove it. Rounding up rather than down keeps us from paying fal more than
 * we charged.
 *
 * @param seconds - Duration to price. The caller decides whether this is the
 *   requested duration (for the pre-flight gate) or the actual output length
 *   (for the deduction).
 * @returns Whole credits, minimum 1 for any non-zero duration.
 */
export function creditCostForDuration(seconds: number): number {
  if (seconds <= 0) return 0;

  return Math.max(1, Math.ceil(seconds * CREDITS_PER_SECOND));
}
