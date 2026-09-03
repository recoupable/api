import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { creditCostForImageUnits } from "@/lib/content/creditCostForImageUnits";

/**
 * Pre-flight credit gate for image generation.
 *
 * Checked before fal is called, so an account without credits never spends
 * our money. These routes carried no gate at all until recoupable/app#2052.
 * `imageCount` is already the exact billable unit count — one image is one
 * unit, unaffected by resolution or aspect ratio.
 *
 * @param accountId - Account being charged.
 * @param imageCount - Images requested (`num_images`).
 * @returns A 402 NextResponse the handler returns directly, or null to proceed.
 */
export const ensureImageCredits = (accountId: string, imageCount: number) =>
  ensureCreditsOrShortCircuit({
    accountId,
    creditsToDeduct: creditCostForImageUnits(imageCount),
  });
