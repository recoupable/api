import { describe, it, expect } from "vitest";
import { aggregateSubagentUsageByModel } from "../aggregateSubagentUsageByModel";

describe("aggregateSubagentUsageByModel", () => {
  it("aggregates multiple task events for the same model", () => {
    const result = aggregateSubagentUsageByModel(
      [
        {
          modelId: "anthropic/claude-sonnet-4.6",
          usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 0 },
        },
        {
          modelId: "anthropic/claude-sonnet-4.6",
          usage: { inputTokens: 3, outputTokens: 2, cachedInputTokens: 1 },
        },
      ],
      "anthropic/claude-haiku-4.5",
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      modelId: "anthropic/claude-sonnet-4.6",
      toolCallCount: 2,
      usage: {
        inputTokens: 13,
        outputTokens: 7,
        cachedInputTokens: 1,
      },
    });
  });

  it("falls back to the main model id when task output omits modelId", () => {
    const result = aggregateSubagentUsageByModel(
      [{ usage: { inputTokens: 4, outputTokens: 1, cachedInputTokens: 0 } }],
      "anthropic/claude-haiku-4.5",
    );

    expect(result[0]?.modelId).toBe("anthropic/claude-haiku-4.5");
    expect(result[0]?.toolCallCount).toBe(1);
  });
});
