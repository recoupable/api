import { describe, it, expect } from "vitest";
import { addCacheControlToTools } from "@/lib/agent/contextManagement/addCacheControlToTools";

const anthropicModel = { provider: "anthropic", modelId: "claude-haiku-4.5" } as never;
const openaiModel = { provider: "openai", modelId: "gpt-5" } as never;

const makeTools = () => ({
  bash: { description: "run bash", inputSchema: {} },
  read: { description: "read file", inputSchema: {} },
  write: { description: "write file", inputSchema: {} },
});

describe("addCacheControlToTools", () => {
  it("returns tools unchanged for non-Anthropic models", () => {
    const tools = makeTools();
    const result = addCacheControlToTools({ tools, model: openaiModel });
    expect(result).toEqual(tools);
  });

  it("returns tools unchanged when the toolset is empty", () => {
    const tools = {};
    const result = addCacheControlToTools({ tools, model: anthropicModel });
    expect(result).toEqual({});
  });

  it("marks ONLY the last tool with ephemeral cacheControl (Anthropic's 4-breakpoint limit)", () => {
    const tools = makeTools();
    const result = addCacheControlToTools({ tools, model: anthropicModel }) as Record<
      string,
      { providerOptions?: { anthropic?: { cacheControl?: { type: string } } } }
    >;
    expect(result.bash?.providerOptions).toBeUndefined();
    expect(result.read?.providerOptions).toBeUndefined();
    expect(result.write?.providerOptions?.anthropic?.cacheControl).toEqual({ type: "ephemeral" });
  });

  it("preserves existing providerOptions on the last tool when merging the anthropic marker", () => {
    const tools = {
      a: { description: "a", inputSchema: {} },
      b: {
        description: "b",
        inputSchema: {},
        providerOptions: { openai: { foo: "bar" } },
      },
    } as never;
    const result = addCacheControlToTools({ tools, model: anthropicModel }) as Record<
      string,
      { providerOptions?: Record<string, unknown> }
    >;
    expect(result.b?.providerOptions?.openai).toEqual({ foo: "bar" });
    expect(result.b?.providerOptions?.anthropic).toEqual({ cacheControl: { type: "ephemeral" } });
  });

  it("respects a custom providerOptions override", () => {
    const tools = { only: { description: "x", inputSchema: {} } } as never;
    const result = addCacheControlToTools({
      tools,
      model: anthropicModel,
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral_1h" } } },
    }) as Record<string, { providerOptions?: { anthropic?: { cacheControl?: { type: string } } } }>;
    expect(result.only?.providerOptions?.anthropic?.cacheControl).toEqual({ type: "ephemeral_1h" });
  });
});
