import { describe, expect, it, vi } from "vitest";
import { routeChatModelStep } from "../routeChatModelStep";
import { selectChatModel } from "@/lib/ai/routing/selectChatModel";
vi.mock("@/lib/ai/routing/selectChatModel", () => ({ selectChatModel: vi.fn() }));
describe("routeChatModelStep", () => {
  it("streams selecting before waiting, then the actual model and explanation", async () => {
    const chunks: unknown[] = [];
    const stream = new WritableStream({
      write: chunk => {
        chunks.push(chunk);
      },
    });
    vi.mocked(selectChatModel).mockImplementation(async () => {
      expect(chunks).toEqual([
        {
          type: "message-metadata",
          messageMetadata: { selectedModelId: "auto", routing: { status: "selecting" } },
        },
      ]);
      return {
        modelId: "test/model",
        routing: {
          modelId: "test/model",
          source: "jev",
          tier: "fast",
          reason: "Simple request",
          confidence: 0.9,
          costUsd: 0.00002,
        },
      };
    });
    const result = await routeChatModelStep([], stream);
    expect(chunks[1]).toEqual({ type: "message-metadata", messageMetadata: result.metadata });
    expect(result.metadata.totalMessageCost).toBe(0.00002);
    expect(stream.locked).toBe(false);
  });
});
