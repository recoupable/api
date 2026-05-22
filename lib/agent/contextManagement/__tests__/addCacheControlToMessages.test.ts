import { describe, it, expect } from "vitest";
import { addCacheControlToMessages } from "@/lib/agent/contextManagement/addCacheControlToMessages";

const anthropicModel = { provider: "anthropic", modelId: "claude-haiku-4.5" } as never;
const openaiModel = { provider: "openai", modelId: "gpt-5" } as never;

const makeMsgs = () => [
  { role: "user", content: "first" },
  { role: "assistant", content: "ack" },
  { role: "user", content: "second" },
];

describe("addCacheControlToMessages", () => {
  it("returns messages unchanged for non-Anthropic models", () => {
    const messages = makeMsgs();
    const result = addCacheControlToMessages({ messages: messages as never, model: openaiModel });
    expect(result).toEqual(messages);
  });

  it("returns messages unchanged when the array is empty", () => {
    const result = addCacheControlToMessages({ messages: [], model: anthropicModel });
    expect(result).toEqual([]);
  });

  it("marks ONLY the last message with ephemeral cacheControl (per Anthropic guidance)", () => {
    const messages = makeMsgs();
    const result = addCacheControlToMessages({
      messages: messages as never,
      model: anthropicModel,
    }) as Array<{ providerOptions?: { anthropic?: { cacheControl?: { type: string } } } }>;
    expect(result[0]?.providerOptions).toBeUndefined();
    expect(result[1]?.providerOptions).toBeUndefined();
    expect(result[2]?.providerOptions?.anthropic?.cacheControl).toEqual({ type: "ephemeral" });
  });

  it("preserves existing providerOptions on the last message when merging the anthropic marker", () => {
    const messages = [
      { role: "user", content: "first" },
      {
        role: "user",
        content: "second",
        providerOptions: { openai: { foo: "bar" } },
      },
    ];
    const result = addCacheControlToMessages({
      messages: messages as never,
      model: anthropicModel,
    }) as Array<{ providerOptions?: Record<string, unknown> }>;
    expect(result[1]?.providerOptions?.openai).toEqual({ foo: "bar" });
    expect(result[1]?.providerOptions?.anthropic).toEqual({
      cacheControl: { type: "ephemeral" },
    });
  });

  it("does NOT mutate the input messages array", () => {
    const messages = makeMsgs();
    addCacheControlToMessages({ messages: messages as never, model: anthropicModel });
    expect((messages[2] as { providerOptions?: unknown }).providerOptions).toBeUndefined();
  });
});
