import { creditCostForDuration } from "@/lib/music/creditCostForDuration";

/**
 * Credits to deduct once a generation has finished.
 *
 * We charge for what fal charges us. The model frequently stops short of the
 * requested length — across our first songs the output averaged 39.9 seconds
 * against a 60-second default — so billing the request would have earned about
 * 1.5x while calling itself pass-through (recoupable/chat#1999).
 *
 * Capped at the requested duration. The model is not hard-capped either: a
 * 60-second request came back at 60.07 seconds. Billing that overrun would put
 * the charge above the figure the caller was quoted before generating, so the
 * sub-cent difference is ours to absorb.
 *
 * Falls back to the requested duration when fal reports no usable length.
 * Charging nothing there would hand over a song fal has already billed us for,
 * and a missing duration is a reporting gap rather than evidence of a free
 * generation.
 *
 * @param requestedSeconds - What the caller asked for, and was gated on.
 * @param actualSeconds - Output length fal reported; null when unknown.
 * @returns Whole credits to deduct.
 */
export function creditsForCompletedGeneration({
  requestedSeconds,
  actualSeconds,
}: {
  requestedSeconds: number;
  actualSeconds: number | null;
}): number {
  const quoted = creditCostForDuration(requestedSeconds);

  if (actualSeconds === null || !Number.isFinite(actualSeconds) || actualSeconds <= 0) {
    return quoted;
  }

  return Math.min(quoted, creditCostForDuration(actualSeconds));
}
