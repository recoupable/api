import { usdToCredits } from "@/lib/credits/usdToCredits";

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
