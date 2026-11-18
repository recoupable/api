import { describe, expect, it, vi } from "vitest";
import { generateText, isStepCount, streamText, tool } from "ai";
import { MockLanguageModelV4, convertArrayToReadableStream } from "ai/test";
import { z } from "zod";
import { buildToolsContext } from "../buildToolsContext";
import type { AgentContext } from "../AgentContext";
import { buildMessageMetadataCallback } from "../../messageMetadata/buildMessageMetadataCallback";

const usage = {
  inputTokens: { total: 10, noCache: 6, cacheRead: 3, cacheWrite: 1 },
  outputTokens: { total: 5, text: 3, reasoning: 2 },
};

describe("installed v7 runtime contracts (no provider calls)", () => {
  it("passes server context by tool name without putting it in model inputs and retains all steps", async () => {
    const execute = vi.fn(async (_input: { value: string }, options: { context: AgentContext }) => {
      expect(options.context.recoupAccessToken).toBe("fixture-private-context");
      return "checked";
    });
    const tools = {
      inspect: tool({ inputSchema: z.object({ value: z.string() }), execute }),
    };
    const model = new MockLanguageModelV4({
      doGenerate: [
        {
          content: [
            {
              type: "tool-call",
              toolCallId: "call-1",
              toolName: "inspect",
              input: '{"value":"test"}',
            },
          ],
          finishReason: { unified: "tool-calls", raw: undefined },
          usage,
          warnings: [],
        },
        {
          content: [{ type: "text", text: "done" }],
          finishReason: { unified: "stop", raw: undefined },
          usage,
          warnings: [],
        },
      ],
    });
    const context: AgentContext = {
      sandbox: { state: {}, workingDirectory: "." },
      model,
      recoupAccessToken: "fixture-private-context",
    };
    const result = await generateText({
      model,
      tools,
      toolsContext: buildToolsContext(tools, context),
      prompt: "inspect test",
      stopWhen: isStepCount(2),
    });
    expect(execute).toHaveBeenCalledOnce();
    expect(result.responseMessages.map(message => message.role)).toEqual([
      "assistant",
      "tool",
      "assistant",
    ]);
    expect(JSON.stringify(model.doGenerateCalls)).not.toContain("fixture-private-context");
    expect(result.usage.inputTokenDetails.cacheReadTokens).toBe(6);
    expect(result.usage.outputTokenDetails.reasoningTokens).toBe(4);
  });

  it("emits cumulative nested usage metadata and omits per-step start/finish chunks", async () => {
    const model = new MockLanguageModelV4({
      doStream: {
        stream: convertArrayToReadableStream([
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "text-1" },
          { type: "text-delta", id: "text-1", delta: "done" },
          { type: "text-end", id: "text-1" },
          { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
        ]),
      },
    });
    const result = streamText({ model, prompt: "hello" });
    const chunks = [];
    const onEnd = vi.fn();
    for await (const chunk of result.toUIMessageStream({
      sendStart: false,
      sendFinish: false,
      generateMessageId: () => "stable-assistant",
      onEnd,
      messageMetadata: buildMessageMetadataCallback({ modelId: "fixture" }),
    }))
      chunks.push(chunk);
    expect(chunks.some(chunk => chunk.type === "start" || chunk.type === "finish")).toBe(false);
    expect(chunks).toContainEqual(
      expect.objectContaining({
        type: "message-metadata",
        messageMetadata: expect.objectContaining({
          totalMessageUsage: expect.objectContaining({
            inputTokens: 10,
            outputTokens: 5,
            inputTokenDetails: { noCacheTokens: 6, cacheReadTokens: 3, cacheWriteTokens: 1 },
            outputTokenDetails: { textTokens: 3, reasoningTokens: 2 },
          }),
        }),
      }),
    );
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onEnd.mock.calls[0][0].responseMessage.id).toBe("stable-assistant");
  });
});
