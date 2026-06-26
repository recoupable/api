import type { LanguageModelUsage } from "ai";
import { addTokenCounts } from "@/lib/agent/messageMetadata/addTokenCounts";

/**
 * Pointwise-sum two `LanguageModelUsage` records (the flat shape used by
 * `ai@^6.0.190`). Mirrors `packages/agent/usage.ts:addLanguageModelUsage`
 * in the open-agents source. Used to accumulate per-step usage into a
 * per-message total inside the `messageMetadata` callback.
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
  };
}
