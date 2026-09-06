import { FLAMINGO_MODEL_ID } from "@/lib/const";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";
import { creditsForFlamingoCall } from "@/lib/flamingo/creditsForFlamingoCall";

interface ChargeForFlamingoCallParams {
  accountId: string;
  /** `elapsed_seconds` from the Modal response, for the log line when the cost is missing. */
  elapsedSeconds: number;
  /** `cost_usd` from the same response: what the call cost us on Modal, when reported. */
  costUsd?: number;
  /** The audio analyzed, stored as `usage_events.resource_url` when present. */
  audioUrl?: string;
}

/**
 * Deducts credits for one completed Music Flamingo model call through the
 * audited path, so it shows on the usage page like every other charge
 * (recoupable/app#2034: never the legacy `deductCredits`).
 *
 * Same shape as `chargeForGeneration`: Modal has already been paid by the
 * time this runs, so a deduction failure is logged, not thrown. The caller's
 * analysis already succeeded and must not turn into an error response.
 */
export async function chargeForFlamingoCall({
  accountId,
  elapsedSeconds,
  costUsd,
  audioUrl,
}: ChargeForFlamingoCallParams): Promise<void> {
  if (costUsd === undefined || !Number.isFinite(costUsd) || costUsd <= 0) {
    console.warn(
      `[chargeForFlamingoCall] no cost_usd on the Modal response (elapsed ${elapsedSeconds}s); charging the base only for account ${accountId}`,
    );
  }
  try {
    const result = await recordCreditDeduction({
      accountId,
      creditsToDeduct: creditsForFlamingoCall({ costUsd }),
      source: "api",
      provider: "modal",
      modelId: FLAMINGO_MODEL_ID,
      ...(audioUrl ? { resourceUrl: audioUrl } : {}),
    });
    if (!result.success) {
      console.error(`[chargeForFlamingoCall] deduction failed for account ${accountId}`);
    }
  } catch (error) {
    console.error(`[chargeForFlamingoCall] deduction threw for account ${accountId}:`, error);
  }
}
