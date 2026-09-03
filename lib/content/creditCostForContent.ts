import { usdToCredits } from "@/lib/credits/usdToCredits";

/**
 * fal's rate for the house still model, per generated image.
 *
 * Muse Image replaced Nano Banana 2 on 2026-09-01: $0.01 against NB2's $0.08,
 * and NB2 billed 2K output at 1.5x ($0.12), which is what our generators were
 * actually set to. A 12x difference on a line a single film pays 30-40 times.
 * Verified directly against fal's billing-events API, 2026-09-03: a real
 * 1-image request billed `cost_total: 0.01`.
 */
export const FAL_IMAGE_USD_PER_UNIT = 0.01;

/**
 * fal's rate for the house video model (MiniMax H3 Max), per billable unit.
 *
 * This is the standing (post-promo) 480p-equivalent rate — fal doesn't bill
 * 768p at a different `unit_price`, it scales the *unit count* by 1.6x
 * instead (see `estimateVideoUnits`). NOTE: fal is running a launch
 * promotion at a $0.0125 unit_price that **ends 2026-09-07**, after which
 * the rate returns to this value. We deliberately charge the standing rate
 * rather than the promo rate, so the price does not quadruple for customers
 * on the day it expires.
 */
export const FAL_VIDEO_USD_PER_UNIT = 0.05;

/** The 768p unit multiplier, confirmed live: a 5s/768P request billed 8 units. */
const RESOLUTION_768P_UNIT_MULTIPLIER = 1.6;

/**
 * Estimate the billable units a video request will cost, before fal has
 * actually run it — used for the pre-flight credit check and as a fallback
 * when the real count (`getFalBillableUnits`) can't be read after
 * generation.
 *
 * @param durationSeconds - Requested `duration`.
 * @param resolution - Requested `resolution`.
 * @returns Estimated billable units.
 */
export function estimateVideoUnits(durationSeconds: number, resolution: "480P" | "768P"): number {
  return resolution === "768P"
    ? durationSeconds * RESOLUTION_768P_UNIT_MULTIPLIER
    : durationSeconds;
}

/**
 * Credits to charge for a set of generated images.
 *
 * @param units - Billable units — one image is one unit.
 * @returns Whole credits; zero for a non-positive count.
 */
export function creditCostForImageUnits(units: number): number {
  if (units <= 0) return 0;
  return usdToCredits(units * FAL_IMAGE_USD_PER_UNIT);
}

/**
 * Credits to charge for generated video.
 *
 * @param units - Billable units, either fal's real `x-fal-billable-units`
 *   or the `estimateVideoUnits` fallback.
 * @returns Whole credits; zero for a non-positive count.
 */
export function creditCostForVideoUnits(units: number): number {
  if (units <= 0) return 0;
  return usdToCredits(units * FAL_VIDEO_USD_PER_UNIT);
}
