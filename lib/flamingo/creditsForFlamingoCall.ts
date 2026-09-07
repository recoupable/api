import { usdToCredits } from "@/lib/credits/usdToCredits";
import { PRICES_USD } from "@/lib/credits/pricesUsd";

/**
 * What Modal charges per second of A100-40GB time, in dollars
 * (https://modal.com/pricing, checked 2026-09-06). The GPU Music Flamingo
 * runs on (`api/modal/serve_music_flamingo.py`, `GPU_TYPE = "A100"`).
 */
export const MODAL_A100_USD_PER_SECOND = 0.000583;

/**
 * Price over compute. Decided on recoupable/app#2061: charge twice what a
 * second of inference costs us, so margin stays fixed however long the prompt
 * or a cold start runs. Internal: the docs state the resulting rate
 * ($0.001166/s), never the multiplier.
 */
export const FLAMINGO_MARKUP = 2;

/** What the customer pays per second of inference, in dollars. */
export const FLAMINGO_USD_PER_SECOND = FLAMINGO_MARKUP * MODAL_A100_USD_PER_SECOND;

/**
 * The base price of one model call, in credits: five cents, owed for every
 * call on top of the metered seconds. Pays for what a per-call
 * `elapsed_seconds` cannot see: the ~26 s container start and the
 * scale-down tail Modal bills per container (measured 2026-09-06,
 * recoupable/app#2061). Also what the pre-flight gate requires per call.
 */
export const FLAMINGO_BASE_CREDITS = usdToCredits(PRICES_USD.flamingoBase);

/**
 * Credits to charge for one Music Flamingo model call: the five-cent base
 * plus $0.001166 per reported second. At the micro-dollar unit a 30 s call is
 * 84,980 credits ($0.08498); a 2 s warm call is 52,332.
 *
 * A non-positive or non-finite duration (the response guard only checks
 * `typeof`) is priced at the base rather than thrown: the call ran, so the
 * base is owed.
 *
 * @param elapsedSeconds - `elapsed_seconds` from the Modal response.
 * @returns Whole credits, never below `FLAMINGO_BASE_CREDITS`.
 */
export function creditsForFlamingoCall(elapsedSeconds: number): number {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return FLAMINGO_BASE_CREDITS;

  return FLAMINGO_BASE_CREDITS + usdToCredits(elapsedSeconds * FLAMINGO_USD_PER_SECOND);
}
