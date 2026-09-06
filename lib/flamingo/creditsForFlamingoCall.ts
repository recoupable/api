import { usdToCredits } from "@/lib/credits/usdToCredits";
import { PRICES_USD } from "@/lib/credits/pricesUsd";

/**
 * Fallback only. What Modal charged per second of A100-40GB time when this
 * was last checked (https://modal.com/pricing, 2026-09-06). The live figure
 * comes back on every model call as `cost_usd`: the container reads the
 * workspace's price list at start (`modal/serve_music_flamingo.py`) and
 * multiplies by the seconds it measured. This constant prices a response
 * that has no `cost_usd`, such as one from a deployment older than that.
 */
export const MODAL_A100_USD_PER_SECOND = 0.000583;

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
  /** `elapsed_seconds` from the Modal response. */
  elapsedSeconds: number;
  /** `cost_usd` from the Modal response: what the call cost us, when reported. */
  costUsd?: number;
}

/**
 * Credits to charge for one Music Flamingo model call: the one-cent base
 * plus `FLAMINGO_MARKUP` × what the call cost us. The cost is Modal's own
 * figure when the response carries one; otherwise the measured seconds at
 * the fallback rate. At the micro-dollar unit a 30 s call at $2.10/h is
 * 44,980 credits either way.
 *
 * A non-positive or non-finite duration with no usable cost (the response
 * guard only checks `typeof`) is priced at the base rather than thrown: the
 * call ran, so the base is owed.
 *
 * @returns Whole credits, never below `FLAMINGO_BASE_CREDITS`.
 */
export function creditsForFlamingoCall({
  elapsedSeconds,
  costUsd,
}: CreditsForFlamingoCallParams): number {
  const usable = (n: number | undefined): n is number => Number.isFinite(n) && (n as number) > 0;
  const cost = usable(costUsd)
    ? costUsd
    : usable(elapsedSeconds)
      ? elapsedSeconds * MODAL_A100_USD_PER_SECOND
      : 0;
  if (cost <= 0) return FLAMINGO_BASE_CREDITS;

  return FLAMINGO_BASE_CREDITS + usdToCredits(FLAMINGO_MARKUP * cost);
}
