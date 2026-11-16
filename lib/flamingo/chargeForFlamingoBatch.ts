import { FLAMINGO_MODEL_ID } from "@/lib/const";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";
import { creditsForFlamingoBatch } from "@/lib/flamingo/creditsForFlamingoBatch";

interface ChargeForFlamingoBatchParams {
  accountId: string;
  /** The batch's total `elapsed_seconds` from the Modal response. */
  elapsedSeconds: number;
  /** How many prompts the batch answered; named in failure logs. */
  promptCount: number;
  /** The audio analyzed, stored as `usage_events.resource_url` when present. */
  audioUrl?: string;
}

/**
 * Deducts credits for one completed batch of Music Flamingo prompts through
 * the audited path: one usage row for the whole batch, with the same ledger
 * fields as `chargeForFlamingoCall` (source, provider, model, resource URL),
 * priced by `creditsForFlamingoBatch`. The usage ledger has no free-text
 * description, so the prompt count appears in the failure logs only.
 *
 * Modal has already been paid by the time this runs, so a deduction failure
 * is logged, not thrown: the batch's answers must still reach the caller.
 */
export async function chargeForFlamingoBatch({
  accountId,
  elapsedSeconds,
  promptCount,
  audioUrl,
}: ChargeForFlamingoBatchParams): Promise<void> {
  const label = `batch of ${promptCount} prompt${promptCount === 1 ? "" : "s"}`;
  try {
    const result = await recordCreditDeduction({
      accountId,
      creditsToDeduct: creditsForFlamingoBatch(elapsedSeconds),
      source: "api",
      provider: "modal",
      modelId: FLAMINGO_MODEL_ID,
      ...(audioUrl ? { resourceUrl: audioUrl } : {}),
    });
    if (!result.success) {
      console.error(`[chargeForFlamingoBatch] ${label}: deduction failed for account ${accountId}`);
    }
  } catch (error) {
    console.error(
      `[chargeForFlamingoBatch] ${label}: deduction threw for account ${accountId}:`,
      error,
    );
  }
}
