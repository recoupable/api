import { usdToCredits } from "@/lib/credits/usdToCredits";

/**
 * fal's rate for the house still model, per generated image.
 *
 * Muse Image replaced Nano Banana 2 on 2026-09-01: $0.01 against NB2's $0.08,
 * and NB2 billed 2K output at 1.5x ($0.12), which is what our generators were
 * actually set to. A 12x difference on a line a single film pays 30-40 times.
 */
export const FAL_IMAGE_USD_PER_IMAGE = 0.01;

/**
 * fal's rate for the house video model (MiniMax H3 Max) at 768p.
 *
 * NOTE: fal is running a launch promotion at $0.02/s that **ends 2026-09-07**,
 * after which the rate returns to this value. We deliberately charge the
 * standing rate rather than the promo rate, so the price does not quadruple
 * for customers on the day it expires.
 */
export const FAL_VIDEO_USD_PER_SECOND = 0.08;

/**
 * Credits to charge for a set of generated images.
 *
 * @param count - Number of images requested (`num_images`).
 * @returns Whole credits; zero for a non-positive count.
 */
export function creditCostForImages(count: number): number {
  if (count <= 0) return 0;
  return usdToCredits(count * FAL_IMAGE_USD_PER_IMAGE);
}

/**
 * Credits to charge for generated video.
 *
 * @param seconds - Duration requested.
 * @returns Whole credits; zero for a non-positive duration.
 */
export function creditCostForVideoSeconds(seconds: number): number {
  if (seconds <= 0) return 0;
  return usdToCredits(seconds * FAL_VIDEO_USD_PER_SECOND);
}
