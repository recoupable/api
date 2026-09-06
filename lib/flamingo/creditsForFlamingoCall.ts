import { usdToCredits } from "@/lib/credits/usdToCredits";
import { PRICES_USD } from "@/lib/credits/pricesUsd";

/**
 * What Modal charges per second of A100-40GB time, in dollars
 * (https://modal.com/pricing, checked 2026-09-06). The GPU Music Flamingo
 * runs on (`api/modal/serve_music_flamingo.py`, `GPU_TYPE = "A100"`).
 */
export const MODAL_A100_USD_PER_SECOND = 0.000583;

/**
 * Price over compute. Decided on recoupable/app#2061: charge twice what the
 * call cost us, so margin stays fixed however long the prompt or a cold
 * start runs.
 */
export const FLAMINGO_MARKUP = 2;

/**
 * The least one model call ever costs, in credits: the one-cent floor that
 * absorbs the idle and scale-down time a per-call `elapsed_seconds` cannot
 * see. Also what the pre-flight gate requires per call.
 */
export const FLAMINGO_MINIMUM_CREDITS = usdToCredits(PRICES_USD.flamingoMinimum);

/**
 * Credits to charge for one Music Flamingo model call: 2x the A100 time the
 * call reported, floored at one cent. At the micro-dollar unit a 30 s call
 * is 34,980 credits ($0.03498); a 2 s warm call is the 10,000-credit floor.
 *
 * @param elapsedSeconds - `elapsed_seconds` from the Modal response.
 * @returns Whole credits, never below `FLAMINGO_MINIMUM_CREDITS`.
 */
export function creditsForFlamingoCall(elapsedSeconds: number): number {
  const metered = usdToCredits(FLAMINGO_MARKUP * elapsedSeconds * MODAL_A100_USD_PER_SECOND);
  return Math.max(FLAMINGO_MINIMUM_CREDITS, metered);
}
