import { describe, it, expect } from "vitest";
import { sumLanguageModelUsage } from "@/lib/agent/messageMetadata/sumLanguageModelUsage";

describe("sumLanguageModelUsage", () => {
  it("returns undefined when both inputs are undefined", () => {
    expect(sumLanguageModelUsage(undefined, undefined)).toBeUndefined();
  });

  it("returns the second input when first is undefined", () => {
    const u = { inputTokens: 100, outputTokens: 50 };
    expect(sumLanguageModelUsage(undefined, u as never)).toBe(u);
  });

  it("returns the first input when second is undefined", () => {
    const u = { inputTokens: 100, outputTokens: 50 };
    expect(sumLanguageModelUsage(u as never, undefined)).toBe(u);
  });

  it("sums the two inputs pointwise when both are present", () => {
    const result = sumLanguageModelUsage(
      { inputTokens: 100, outputTokens: 50 } as never,
      { inputTokens: 200, outputTokens: 75 } as never,
    );
    expect(result?.inputTokens).toBe(300);
    expect(result?.outputTokens).toBe(125);
  });
});
