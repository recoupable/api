import type { AvailableModelCost, AvailableModelCostTier } from "@/lib/credits/AvailableModelCost";

const TOKENS_PER_MILLION = 1_000_000;

/**
 * Picks the right cost tier for `usage`. Above 200k input tokens many
 * providers charge more, so the cost catalog exposes an override on
 * `cost.context_over_200k`. Missing fields fall back to the base tier
 * so a partial override is still valid.
 *
 * The trigger is "input > 200k AND at least one of input/output is
 * overridden" — a tier that only overrides `cache_read` is treated as
 * the base tier (it's not a real tier swap, just a cache discount).
 */
function resolveCostTier(
  usage: { inputTokens: number },
  cost: AvailableModelCost | undefined,
): AvailableModelCostTier | undefined {
  if (!cost) return undefined;

  if (
    usage.inputTokens > 200_000 &&
    (typeof cost.context_over_200k?.input === "number" ||
      typeof cost.context_over_200k?.output === "number")
  ) {
    return {
      input: cost.context_over_200k.input ?? cost.input,
      output: cost.context_over_200k.output ?? cost.output,
      cache_read: cost.context_over_200k.cache_read ?? cost.cache_read,
    };
  }

  return cost;
}

/**
 * Token-based estimate of a turn's USD cost, used as a fallback when
 * the gateway hasn't reported an actual cost on the
 * `assistantMessage.metadata.totalMessageCost` field.
 *
 * Ports `apps/web/lib/models.ts:estimateModelUsageCost` from
 * open-agents so the same per-turn math runs on both sides during the
 * cutover. Cached input tokens are billed at `cache_read` when the
 * catalog exposes it and fall back to the base input price otherwise.
 *
 * Returns `undefined` when the catalog can't price this model (missing
 * cost entry, missing input price, or missing output price) so the
 * caller knows to use a different fallback (open-agents' rule: never
 * charge 0 — bill the 1c minimum instead).
 *
 * @param usage Token counts for the turn (mirrors AI SDK's `LanguageModelUsage`).
 * @param cost Per-model catalog entry. `undefined` short-circuits to `undefined`.
 * @returns USD cost, or `undefined` if not priceable.
 */
export function estimateModelUsageCost(
  usage: {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
  },
  cost: AvailableModelCost | undefined,
): number | undefined {
  const costTier = resolveCostTier(usage, cost);
  const inputPrice = costTier?.input;
  const outputPrice = costTier?.output;
  if (typeof inputPrice !== "number" || typeof outputPrice !== "number") {
    return undefined;
  }

  const cachedInputTokens = Math.max(0, usage.cachedInputTokens);
  const uncachedInputTokens = Math.max(0, usage.inputTokens - cachedInputTokens);
  const cacheReadPrice = costTier?.cache_read ?? inputPrice;

  return (
    (uncachedInputTokens * inputPrice) / TOKENS_PER_MILLION +
    (cachedInputTokens * cacheReadPrice) / TOKENS_PER_MILLION +
    (Math.max(0, usage.outputTokens) * outputPrice) / TOKENS_PER_MILLION
  );
}
