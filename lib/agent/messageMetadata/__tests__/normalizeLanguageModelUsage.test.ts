import { expect, it } from "vitest";
import { normalizeLanguageModelUsage } from "../normalizeLanguageModelUsage";

it("keeps known legacy counts without inventing unknown token details", () => {
  const usage = normalizeLanguageModelUsage({
    inputTokens: 100,
    cachedInputTokens: 12,
    reasoningTokens: 3,
  });
  expect(usage.inputTokenDetails).toEqual({
    noCacheTokens: undefined,
    cacheReadTokens: 12,
    cacheWriteTokens: undefined,
  });
  expect(usage.outputTokenDetails).toEqual({ textTokens: undefined, reasoningTokens: 3 });
  expect(usage.totalTokens).toBeUndefined();
});

it("prefers explicit nested zero over conflicting flat legacy values", () => {
  const usage = normalizeLanguageModelUsage({
    cachedInputTokens: 12,
    reasoningTokens: 3,
    inputTokenDetails: { noCacheTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 },
    outputTokenDetails: { textTokens: 5, reasoningTokens: 0 },
  });
  expect(usage.inputTokenDetails.cacheReadTokens).toBe(0);
  expect(usage.outputTokenDetails.reasoningTokens).toBe(0);
});
