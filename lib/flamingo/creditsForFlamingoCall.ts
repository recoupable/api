import { usdToCredits } from "@/lib/credits/usdToCredits";
import { PRICES_USD } from "@/lib/credits/pricesUsd";

/**
 * Price over compute. Decided on recoupable/app#2061: charge twice what the
 * call cost us, so margin stays fixed however long the prompt or a cold
 * start runs, and however Modal reprices. Internal: the docs state the
 * resulting rate, never the multiplier.
 */
export const FLAMINGO_MARKUP = 2;

/**
 * The base price of one model call, in credits: a cent, owed for every call
 * on top of the metered compute. Covers the idle and scale-down time a
 * per-call figure cannot see, and is what the pre-flight gate requires.
 */
export const FLAMINGO_BASE_CREDITS = usdToCredits(PRICES_USD.flamingoBase);

interface CreditsForFlamingoCallParams {
  /**
   * `cost_usd` from the Modal response: what the call cost us. The container
   * computes it from the workspace's live GPU rate (read from Modal at
   * start, `modal/serve_music_flamingo.py`) × the seconds it measured. The
   * api holds no rate of its own.
   */
  costUsd?: number;
}

/**
 * Credits to charge for one Music Flamingo model call: the one-cent base
 * plus `FLAMINGO_MARKUP` × what the call cost us. At the micro-dollar unit a
 * 30 s call at $2.10/h ($0.01749) is 44,980 credits.
 *
 * A response with no usable cost (a deployment older than `cost_usd`, or a
 * malformed number) is priced at the base: the call ran, so the base is
 * owed, and the caller logs the gap rather than guessing a rate here.
 *
 * @returns Whole credits, never below `FLAMINGO_BASE_CREDITS`.
 */
export function creditsForFlamingoCall({ costUsd }: CreditsForFlamingoCallParams): number {
  if (costUsd === undefined || !Number.isFinite(costUsd) || costUsd <= 0) {
    return FLAMINGO_BASE_CREDITS;
  }

  return FLAMINGO_BASE_CREDITS + usdToCredits(FLAMINGO_MARKUP * costUsd);
}
