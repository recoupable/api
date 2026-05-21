import type { LanguageModelUsage } from "ai";

function addTokenCounts(a: number | undefined, b: number | undefined): number | undefined {
  if (a == null && b == null) return undefined;
  return (a ?? 0) + (b ?? 0);
}

/**
 * Pointwise-sum two `LanguageModelUsage` records. Mirrors open-agents'
 * `packages/agent/usage.ts:addLanguageModelUsage`. Used to accumulate
 * per-step usage into a per-message total inside the `messageMetadata`
 * callback.
 *
 * Returns `undefined` for fields that are missing on BOTH inputs, so
 * the resulting usage object stays sparse rather than introducing
 * spurious zeros.
 */
export function addLanguageModelUsage(
  a: LanguageModelUsage,
  b: LanguageModelUsage,
): LanguageModelUsage {
  return {
    inputTokens: addTokenCounts(a.inputTokens, b.inputTokens),
    inputTokenDetails: {
      noCacheTokens: addTokenCounts(
        a.inputTokenDetails?.noCacheTokens,
        b.inputTokenDetails?.noCacheTokens,
      ),
      cacheReadTokens: addTokenCounts(
        a.inputTokenDetails?.cacheReadTokens,
        b.inputTokenDetails?.cacheReadTokens,
      ),
      cacheWriteTokens: addTokenCounts(
        a.inputTokenDetails?.cacheWriteTokens,
        b.inputTokenDetails?.cacheWriteTokens,
      ),
    },
    outputTokens: addTokenCounts(a.outputTokens, b.outputTokens),
    outputTokenDetails: {
      textTokens: addTokenCounts(
        a.outputTokenDetails?.textTokens,
        b.outputTokenDetails?.textTokens,
      ),
      reasoningTokens: addTokenCounts(
        a.outputTokenDetails?.reasoningTokens,
        b.outputTokenDetails?.reasoningTokens,
      ),
    },
    totalTokens: addTokenCounts(a.totalTokens, b.totalTokens),
    reasoningTokens: addTokenCounts(a.reasoningTokens, b.reasoningTokens),
    cachedInputTokens: addTokenCounts(a.cachedInputTokens, b.cachedInputTokens),
  } as LanguageModelUsage;
}
