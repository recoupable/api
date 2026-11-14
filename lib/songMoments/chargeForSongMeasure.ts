import { SONG_MOMENTS_MODEL_ID } from "@/lib/const";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";
import { SONG_MEASURE_CREDITS } from "@/lib/songMoments/songMeasureCredits";

/**
 * Deducts the flat measurement price through the audited path, like
 * `chargeForFlamingoCall`. The measurement already ran, so a deduction failure
 * is logged, not thrown.
 */
export async function chargeForSongMeasure({
  accountId,
  audioUrl,
}: {
  accountId: string;
  audioUrl: string;
}): Promise<void> {
  try {
    const result = await recordCreditDeduction({
      accountId,
      creditsToDeduct: SONG_MEASURE_CREDITS,
      source: "api",
      provider: "modal",
      modelId: SONG_MOMENTS_MODEL_ID,
      resourceUrl: audioUrl,
    });
    if (!result.success) {
      console.error(`[chargeForSongMeasure] deduction failed for account ${accountId}`);
    }
  } catch (error) {
    console.error(`[chargeForSongMeasure] deduction threw for account ${accountId}:`, error);
  }
}
