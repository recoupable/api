import { PRICES_USD } from "@/lib/credits/pricesUsd";
import { usdToCredits } from "@/lib/credits/usdToCredits";

/**
 * The flat price of measuring one song's sections and moments, in credits.
 * The measurement runs on a CPU container for a few seconds, well under a
 * cent of compute; the flat price also covers cold starts.
 */
export const SONG_MEASURE_CREDITS = usdToCredits(PRICES_USD.songMomentsMeasure);
