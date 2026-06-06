import { describe, it, expect } from "vitest";
import { collectTaskToolUsageEvents } from "../collectTaskToolUsageEvents";

describe("collectTaskToolUsageEvents", () => {
  it("returns usage from completed task tool parts", () => {
    const events = collectTaskToolUsageEvents({
      id: "m1",
      role: "assistant",
      parts: [
        {
          type: "tool-task",
          toolCallId: "tc-1",
          state: "output-available",
          input: {},
          output: {
            usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 0 },
            modelId: "anthropic/claude-sonnet-4.6",
          },
        },
      ] as never,
    });

    expect(events).toEqual([
      {
        usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 0 },
        modelId: "anthropic/claude-sonnet-4.6",
        toolCallId: "tc-1",
      },
    ]);
  });

  it("skips task parts without output", () => {
    const events = collectTaskToolUsageEvents({
      id: "m2",
      role: "assistant",
      parts: [
        {
          type: "tool-task",
          toolCallId: "tc-2",
          state: "input-available",
          input: {},
        },
      ] as never,
    });

    expect(events).toEqual([]);
  });
});
