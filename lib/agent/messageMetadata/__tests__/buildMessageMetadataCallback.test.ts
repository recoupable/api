import { describe, it, expect } from "vitest";
import { buildMessageMetadataCallback } from "@/lib/agent/messageMetadata/buildMessageMetadataCallback";

const MODEL_ID = "anthropic/claude-haiku-4.5";

function finishStepPart(opts: {
  inputTokens?: number;
  outputTokens?: number;
  cost?: string;
  finishReason?: string;
}) {
  return {
    type: "finish-step",
    usage: {
      inputTokens: opts.inputTokens ?? 100,
      outputTokens: opts.outputTokens ?? 50,
      totalTokens: (opts.inputTokens ?? 100) + (opts.outputTokens ?? 50),
    },
    providerMetadata: opts.cost ? { gateway: { cost: opts.cost } } : undefined,
    finishReason: opts.finishReason ?? "tool-calls",
  } as never;
}

describe("buildMessageMetadataCallback", () => {
  it("returns undefined for non-finish-step parts (start, text-delta, tool-call, etc.)", () => {
    const cb = buildMessageMetadataCallback({ modelId: MODEL_ID });
    expect(cb({ part: { type: "text-delta", delta: "hi" } as never })).toBeUndefined();
    expect(cb({ part: { type: "start" } as never })).toBeUndefined();
    expect(cb({ part: { type: "tool-call", toolName: "bash" } as never })).toBeUndefined();
  });

  it("emits modelId + selectedModelId + usage on the first finish-step", () => {
    const cb = buildMessageMetadataCallback({ modelId: MODEL_ID });
    const meta = cb({ part: finishStepPart({ inputTokens: 100, outputTokens: 50 }) });
    expect(meta).toMatchObject({
      modelId: MODEL_ID,
      selectedModelId: MODEL_ID,
      lastStepUsage: { inputTokens: 100, outputTokens: 50 },
      totalMessageUsage: { inputTokens: 100, outputTokens: 50 },
    });
  });

  it("emits cost when the gateway provider metadata includes it", () => {
    const cb = buildMessageMetadataCallback({ modelId: MODEL_ID });
    const meta = cb({ part: finishStepPart({ cost: "0.025" }) });
    expect(meta).toMatchObject({ lastStepCost: 0.025, totalMessageCost: 0.025 });
  });

  it("omits cost fields when the gateway did not report one", () => {
    const cb = buildMessageMetadataCallback({ modelId: MODEL_ID });
    const meta = cb({ part: finishStepPart({}) }) as Record<string, unknown>;
    expect(meta.lastStepCost).toBeUndefined();
    expect(meta.totalMessageCost).toBeUndefined();
  });

  it("accumulates usage AND cost across multiple finish-step calls", () => {
    const cb = buildMessageMetadataCallback({ modelId: MODEL_ID });
    cb({ part: finishStepPart({ inputTokens: 100, outputTokens: 50, cost: "0.01" }) });
    const meta = cb({
      part: finishStepPart({ inputTokens: 200, outputTokens: 75, cost: "0.03" }),
    });
    expect(meta).toMatchObject({
      lastStepUsage: { inputTokens: 200, outputTokens: 75 },
      totalMessageUsage: { inputTokens: 300, outputTokens: 125 },
      lastStepCost: 0.03,
      totalMessageCost: 0.04,
    });
  });

  it("records lastStepFinishReason and stepFinishReasons history", () => {
    const cb = buildMessageMetadataCallback({ modelId: MODEL_ID });
    cb({ part: finishStepPart({ finishReason: "tool-calls" }) });
    const meta = cb({ part: finishStepPart({ finishReason: "stop" }) });
    expect(meta).toMatchObject({
      lastStepFinishReason: "stop",
      stepFinishReasons: [{ finishReason: "tool-calls" }, { finishReason: "stop" }],
    });
  });
});
