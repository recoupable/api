import { getModel } from "@/lib/ai/getModel";
import { LanguageModelUsage } from "ai";

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
 *      minimum via `Math.max(1, Math.round(usd * 100))`).
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

  try {
    const model = await getModel(modelId);
    if (!model) {
      console.error(`Model not found for ID: ${modelId}`);
      return 0;
    }

    const { inputTokens, outputTokens } = usage;

    if (!inputTokens || !outputTokens) {
      console.error("No tokens found in usage");
      return 0;
    }

    // Check if model has pricing
    if (!model.pricing?.input || !model.pricing?.output) {
      return 0;
    }

    const inputCost = inputTokens * Number(model.pricing.input);
    const outputCost = outputTokens * Number(model.pricing.output);
    const totalCost = inputCost + outputCost;

    return totalCost;
  } catch (error) {
    console.error("Failed to calculate credit usage:", error);
    return 0;
  }
};
