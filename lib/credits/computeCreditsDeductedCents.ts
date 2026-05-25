import { getAvailableModels } from "@/lib/ai/getAvailableModels";
import { estimateModelUsageCost } from "@/lib/credits/estimateModelUsageCost";
import type { AvailableModelCost } from "@/lib/credits/AvailableModelCost";

/**
 * Per-turn credit charge in cents (minimum 1).
 *
 * Mirrors open-agents'
 * `apps/web/lib/credits/compute-credits-deducted-cents.ts` so the same
 * billing math runs on both sides of the chat cutover. Resolution order:
 *
 *   1. Gateway-reported cost on `responseMessage.metadata.totalMessageCost`
 *      — the exact number the chat UI shows next to the assistant
 *      response. Used directly so the wallet debit converges with the
 *      cost label.
 *   2. Token-based estimate against the model catalog's `cost` entry.
 *      Catalog is the same gateway / models.dev pipeline that backs
 *      `GET /api/ai/models`.
 *   3. 1c floor when no pricing is available — every successful turn
 *      moves the wallet by at least 1c so a transient catalog outage
 *      can't make a turn free.
 *
 * Errors in the catalog fetch are swallowed and treated as path #3 —
 * the caller (recordChatUsage) must not fail the workflow on a credit
 * accounting hiccup.
 *
 * @param usage Token counts for the turn (matches AI SDK's `LanguageModelUsage`).
 * @param modelId Fully qualified gateway id (e.g. `anthropic/claude-haiku-4.5`).
 * @param gatewayCostUsd Gateway-reported total USD cost for the turn,
 *   when available. Subagent steps (collectTaskToolUsageEvents) won't
 *   have one and fall through to the token estimate.
 * @returns Integer cent amount, ≥ 1.
 */
export async function computeCreditsDeductedCents(
  usage: {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
  },
  modelId: string,
  gatewayCostUsd?: number,
): Promise<number> {
  if (typeof gatewayCostUsd === "number" && Number.isFinite(gatewayCostUsd) && gatewayCostUsd > 0) {
    return Math.max(1, Math.round(gatewayCostUsd * 100));
  }

  try {
    const models = await getAvailableModels();
    const model = models.find(m => m.id === modelId) as { cost?: AvailableModelCost } | undefined;
    const usd = estimateModelUsageCost(usage, model?.cost);
    if (typeof usd !== "number" || usd <= 0) return 1;
    return Math.max(1, Math.round(usd * 100));
  } catch (error) {
    console.error("Failed to compute credits from usage:", error);
    return 1;
  }
}
