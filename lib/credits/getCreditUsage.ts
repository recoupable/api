import { getTokenCreditUsageStep } from "./getTokenCreditUsageStep";
import type { LanguageModelUsage } from "ai";

/**
 * Calculates the total spend in USD for a given language model usage.
 *
 * Resolution order:
 *   1. `gatewayCostUsd` — gateway-reported actual cost from
 *      `responseMessage.metadata.totalMessageCost`. Used directly when
 *      present and positive so the wallet debit converges with the cost
 *      label the chat UI shows next to the assistant response.
 *   2. Token-based estimate using `model.pricing.input/output` from
 *      the gateway catalog (`getModel`). Authoritative for token cost.
 *   3. `0` when nothing prices the turn (caller floors to the 1c
 *      minimum via `usdToCredits`, which floors at one credit).
 *
 * @param usage - The language model usage data
 * @param modelId - The ID of the model used
 * @param gatewayCostUsd - Optional gateway-reported USD cost (preferred over token math)
 * @returns The total spend in USD or 0 if calculation fails
 */
export const getCreditUsage = async (
  usage: LanguageModelUsage,
  modelId: string,
  gatewayCostUsd?: number,
): Promise<number> => {
  if (typeof gatewayCostUsd === "number" && Number.isFinite(gatewayCostUsd) && gatewayCostUsd > 0) {
    return gatewayCostUsd;
  }

  return getTokenCreditUsageStep(
    { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
    modelId,
  );
};
