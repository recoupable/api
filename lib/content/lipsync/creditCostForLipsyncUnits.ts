import { usdToCredits } from "@/lib/credits/usdToCredits";
import { LIPSYNC_USD_PER_UNIT } from "./constants";

/** Model-specific credits; LTX megapixels are not H3 video seconds. */
export function creditCostForLipsyncUnits(units: number): number {
  return units > 0 ? usdToCredits(units * LIPSYNC_USD_PER_UNIT) : 0;
}
