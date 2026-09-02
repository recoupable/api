import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import {
  creditCostForImages,
  creditCostForVideoSeconds,
} from "@/lib/content/creditCostForContent";

/**
 * Credit gate for image generation.
 *
 * Checked before fal is called, so an account without credits never spends our
 * money. These routes carried no gate at all until recoupable/app#2052.
 *
 * @param accountId - Account being charged.
 * @param imageCount - Images requested (`num_images`).
 * @returns A 402 NextResponse the handler returns directly, or null to proceed.
 */
export const ensureImageCredits = (accountId: string, imageCount: number) =>
  ensureCreditsOrShortCircuit({
    accountId,
    creditsToDeduct: creditCostForImages(imageCount),
  });

/**
 * Credit gate for video generation.
 *
 * @param accountId - Account being charged.
 * @param seconds - Duration requested.
 * @param mode - The video mode; `lipsync` is priced at the dearer rate.
 * @returns A 402 NextResponse the handler returns directly, or null to proceed.
 */
export const ensureVideoCredits = (accountId: string, seconds: number, mode: string) =>
  ensureCreditsOrShortCircuit({
    accountId,
    creditsToDeduct: creditCostForVideoSeconds(seconds, mode),
  });
