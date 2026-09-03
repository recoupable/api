import { getFalBillableUnits } from "@/lib/fal/getFalBillableUnits";
import { deductCredits } from "@/lib/credits/deductCredits";

interface ChargeForGenerationParams {
  accountId: string;
  /** The fal endpoint id the generation ran on. */
  endpointId: string;
  /** `Result.requestId` from the completed `fal.subscribe` call. */
  requestId: string;
  /** Used only if fal's real billed count can't be read. */
  fallbackUnits: number;
  /** Converts a unit count into credits — the model-specific `$/unit` rate. */
  creditsForUnits: (units: number) => number;
}

/**
 * Deducts credits for a completed fal generation, on the real billed unit
 * count when it's available (recoupable/app#2052).
 *
 * Shared by `createImageHandler.ts` and `createVideoHandler.ts` — both do
 * the same thing after a successful `fal.subscribe`, just with different
 * unit and pricing functions. fal has already been paid by the time this
 * runs, so a deduction failure is logged, not thrown: the caller's
 * generation already succeeded and must not turn into an error response.
 */
export async function chargeForGeneration({
  accountId,
  endpointId,
  requestId,
  fallbackUnits,
  creditsForUnits,
}: ChargeForGenerationParams): Promise<void> {
  const units = (await getFalBillableUnits(endpointId, requestId)) ?? fallbackUnits;
  try {
    await deductCredits({ accountId, creditsToDeduct: creditsForUnits(units) });
  } catch (error) {
    console.error(`[chargeForGeneration] deductCredits failed for request ${requestId}:`, error);
  }
}
