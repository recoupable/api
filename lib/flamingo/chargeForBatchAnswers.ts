import { chargeForFlamingoBatch } from "@/lib/flamingo/chargeForFlamingoBatch";
import type { FlamingoBatchAnswer } from "@/lib/flamingo/isFlamingoGenerateBatchResult";

/**
 * Charges one batch for the answers the caller could use: one base price
 * plus the seconds those answers took, as a single usage row. An answer the
 * caller had to drop (unparseable, missing) costs nothing, and no usable
 * answer at all means no charge, as when each section was its own call
 * (recoupable/app#2061). Never throws, like `chargeForFlamingoBatch`.
 *
 * @param params - The account, the answers that were used, and the audio to
 *   record on the usage row (omit for temporary attachment URLs).
 */
export async function chargeForBatchAnswers({
  accountId,
  answers,
  audioUrl,
}: {
  accountId: string;
  answers: Pick<FlamingoBatchAnswer, "elapsed_seconds">[];
  audioUrl?: string;
}): Promise<void> {
  if (answers.length === 0) return;
  const seconds = answers.reduce((total, answer) => total + answer.elapsed_seconds, 0);
  await chargeForFlamingoBatch({
    accountId,
    elapsedSeconds: seconds,
    promptCount: answers.length,
    ...(audioUrl ? { audioUrl } : {}),
  });
}
