import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { creditCostForVideoUnits } from "@/lib/content/creditCostForVideoUnits";
import { estimateVideoUnits } from "@/lib/content/estimateVideoUnits";

/**
 * Pre-flight credit gate for video generation.
 *
 * Checked before fal is called, so an account without credits never spends
 * our money. Uses `estimateVideoUnits` since the real `x-fal-billable-units`
 * count isn't known until after fal has run.
 *
 * @param accountId - Account being charged.
 * @param durationSeconds - Requested `duration`.
 * @param resolution - Requested `resolution`.
 * @returns A 402 NextResponse the handler returns directly, or null to proceed.
 */
export const ensureVideoCredits = (
  accountId: string,
  durationSeconds: number,
  resolution: "480P" | "768P",
) =>
  ensureCreditsOrShortCircuit({
    accountId,
    creditsToDeduct: creditCostForVideoUnits(estimateVideoUnits(durationSeconds, resolution)),
  });
