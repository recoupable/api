/** Credits per second of requested audio. */
const CREDITS_PER_SECOND = 0.5;

/**
 * Floor charge. fal bills per output second, but every generation also costs a
 * workflow run, a storage write, and a slot in the queue — so a 10-second song
 * is not a tenth as expensive to serve as a 100-second one.
 */
const MIN_CREDIT_COST = 15;

/**
 * Credits to charge for a music generation of the requested length.
 *
 * fal charges $0.002 per output second, so a 60-second song costs us about
 * $0.12; at 1 credit ≈ 1 cent this returns 30, roughly 2.5x cost — the same
 * margin posture as the research endpoints.
 *
 * Priced on the *requested* duration, which is what the caller is quoted
 * before generating. The model may stop early, and refunding the difference
 * afterwards would make the quoted price a lie.
 *
 * @param requestedDurationSeconds - Upper bound the caller asked for.
 * @returns Whole credits to gate on and, once the song lands, to deduct.
 */
export function creditCostForDuration(requestedDurationSeconds: number): number {
  return Math.max(MIN_CREDIT_COST, Math.ceil(requestedDurationSeconds * CREDITS_PER_SECOND));
}
