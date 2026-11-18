import type { LanguageModelUsage } from "ai";

/** Normalize saved v6 usage and live v7 usage; nested counts take precedence, including zero. */
export function normalizeLanguageModelUsage(
  usage: Partial<LanguageModelUsage> & { cachedInputTokens?: number; reasoningTokens?: number },
): LanguageModelUsage {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    inputTokenDetails: {
      noCacheTokens: usage.inputTokenDetails?.noCacheTokens,
      cacheReadTokens: usage.inputTokenDetails?.cacheReadTokens ?? usage.cachedInputTokens,
      cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens,
    },
    outputTokenDetails: {
      textTokens: usage.outputTokenDetails?.textTokens,
      reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? usage.reasoningTokens,
    },
  };
}
