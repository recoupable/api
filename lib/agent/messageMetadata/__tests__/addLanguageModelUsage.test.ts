import { describe, it, expect } from "vitest";
import { addLanguageModelUsage } from "@/lib/agent/messageMetadata/addLanguageModelUsage";

describe("addLanguageModelUsage", () => {
  it("sums basic input/output/total tokens", () => {
    const result = addLanguageModelUsage(
      { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      { inputTokens: 200, outputTokens: 75, totalTokens: 275 },
    );
    expect(result.inputTokens).toBe(300);
    expect(result.outputTokens).toBe(125);
    expect(result.totalTokens).toBe(425);
  });

  it("sums nested cache token details", () => {
    const result = addLanguageModelUsage(
      {
        inputTokens: 100,
        outputTokens: 50,
        inputTokenDetails: { cacheReadTokens: 10, cacheWriteTokens: 5, noCacheTokens: 85 },
      } as never,
      {
        inputTokens: 200,
        outputTokens: 75,
        inputTokenDetails: { cacheReadTokens: 20, cacheWriteTokens: 15, noCacheTokens: 165 },
      } as never,
    );
    expect(result.inputTokenDetails?.cacheReadTokens).toBe(30);
    expect(result.inputTokenDetails?.cacheWriteTokens).toBe(20);
    expect(result.inputTokenDetails?.noCacheTokens).toBe(250);
  });

  it("returns undefined for fields missing on both inputs", () => {
    const result = addLanguageModelUsage(
      { inputTokens: 100 } as never,
      { inputTokens: 200 } as never,
    );
    expect(result.outputTokens).toBeUndefined();
    expect(result.totalTokens).toBeUndefined();
  });

  it("treats missing field on one side as 0", () => {
    const result = addLanguageModelUsage(
      { inputTokens: 100, outputTokens: 50 } as never,
      { inputTokens: 200 } as never,
    );
    expect(result.outputTokens).toBe(50);
  });
});
