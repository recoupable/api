import { describe, it, expect, vi, beforeEach } from "vitest";
import { streamText } from "ai";
import { runAgentStep } from "@/app/lib/workflows/runAgentStep";

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return { ...actual, streamText: vi.fn() };
});

// Avoid pulling in real gateway / fetch surface.
vi.mock("@ai-sdk/gateway", () => ({
  gateway: vi.fn((modelId: string) => ({ modelId, __mock: "gateway" })),
}));

function makeStreamResult(opts?: {
  metadataCalls?: Array<unknown>;
  onFinishCalls?: Array<unknown>;
  emittedResponseMessage?: unknown;
}) {
  const calls = opts?.metadataCalls ?? [];
  const onFinishCalls = opts?.onFinishCalls ?? [];
  return {
    toUIMessageStream: vi.fn((streamOpts: { messageMetadata?: unknown; onFinish?: unknown }) => {
      // Capture the callbacks so tests can inspect (and invoke) them
      calls.push(streamOpts.messageMetadata);
      onFinishCalls.push(streamOpts.onFinish);
      return (async function* () {
        yield { type: "start" };
        yield { type: "finish" };
        // Mirror the AI SDK contract: onFinish fires after the
        // generator yields its last chunk with the assembled message.
        if (typeof streamOpts.onFinish === "function" && opts?.emittedResponseMessage) {
          (streamOpts.onFinish as (a: { responseMessage: unknown }) => void)({
            responseMessage: opts.emittedResponseMessage,
          });
        }
      })();
    }),
    finishReason: Promise.resolve("stop"),
  };
}

function makeWritable() {
  const written: unknown[] = [];
  const stream = new WritableStream({
    write(chunk) {
      written.push(chunk);
    },
  });
  return { stream, written };
}

const baseInput = {
  messages: [
    {
      id: "m1",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "hi" }],
    },
  ],
  modelId: "anthropic/claude-haiku-4.5",
  agentContext: {
    sandbox: { state: { type: "vercel" }, workingDirectory: "/sandbox/mono" },
  },
  assistantMessageId: "asst-test-id",
};

describe("runAgentStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wires a messageMetadata callback into toUIMessageStream", async () => {
    const captured: unknown[] = [];
    vi.mocked(streamText).mockReturnValue(makeStreamResult({ metadataCalls: captured }) as never);
    const { stream } = makeWritable();

    await runAgentStep({ ...baseInput, writable: stream } as never);

    expect(captured).toHaveLength(1);
    expect(typeof captured[0]).toBe("function");
  });

  it("the wired callback emits modelId on finish-step parts", async () => {
    const captured: unknown[] = [];
    vi.mocked(streamText).mockReturnValue(makeStreamResult({ metadataCalls: captured }) as never);
    const { stream } = makeWritable();

    await runAgentStep({ ...baseInput, writable: stream } as never);

    const cb = captured[0] as (args: {
      part: { type: string; usage?: unknown; finishReason?: string };
    }) => { modelId?: string } | undefined;
    const meta = cb({
      part: {
        type: "finish-step",
        usage: { inputTokens: 10, outputTokens: 5 },
        finishReason: "stop",
      },
    });
    expect(meta).toBeDefined();
    expect(meta?.modelId).toBe("anthropic/claude-haiku-4.5");
  });

  it("includes cwd from agentContext.sandbox in the system prompt", async () => {
    const captured: unknown[] = [];
    vi.mocked(streamText).mockReturnValue(makeStreamResult({ metadataCalls: captured }) as never);
    const { stream } = makeWritable();

    await runAgentStep({
      ...baseInput,
      agentContext: {
        sandbox: {
          state: { type: "vercel" },
          workingDirectory: "/sandbox/mono",
        },
      },
      writable: stream,
    } as never);

    const args = vi.mocked(streamText).mock.calls[0]?.[0] as { system?: string };
    expect(args.system).toMatch(/# Environment/);
    expect(args.system).toMatch(/Working directory: \. \(workspace root\)/);
    expect(args.system).toMatch(/workspace-relative paths/);
  });

  it("wraps tools with anthropic cacheControl on the last tool before passing to streamText", async () => {
    const captured: unknown[] = [];
    vi.mocked(streamText).mockReturnValue(makeStreamResult({ metadataCalls: captured }) as never);
    const { stream } = makeWritable();

    await runAgentStep({ ...baseInput, writable: stream } as never);

    const args = vi.mocked(streamText).mock.calls[0]?.[0] as {
      tools: Record<
        string,
        { providerOptions?: { anthropic?: { cacheControl?: { type: string } } } }
      >;
    };
    const toolNames = Object.keys(args.tools);
    expect(toolNames.length).toBeGreaterThan(0);
    const lastTool = args.tools[toolNames[toolNames.length - 1]!]!;
    expect(lastTool.providerOptions?.anthropic?.cacheControl).toEqual({ type: "ephemeral" });
    // Earlier tools should NOT carry the cache-control marker (Anthropic 4-breakpoint limit).
    if (toolNames.length > 1) {
      expect(args.tools[toolNames[0]!]?.providerOptions).toBeUndefined();
    }
  });

  it("wires a prepareStep callback that marks the last message with cacheControl", async () => {
    const captured: unknown[] = [];
    vi.mocked(streamText).mockReturnValue(makeStreamResult({ metadataCalls: captured }) as never);
    const { stream } = makeWritable();

    await runAgentStep({ ...baseInput, writable: stream } as never);

    const args = vi.mocked(streamText).mock.calls[0]?.[0] as {
      prepareStep?: (opts: {
        messages: Array<{ role: string; providerOptions?: Record<string, unknown> }>;
        model: unknown;
        steps?: unknown[];
      }) => { messages?: unknown[] } | undefined;
    };
    expect(typeof args.prepareStep).toBe("function");
    const anthropicModel = { provider: "anthropic", modelId: "claude-haiku-4.5" } as never;
    const result = args.prepareStep!({
      messages: [
        { role: "user", content: "first" } as never,
        { role: "user", content: "second" } as never,
      ],
      model: anthropicModel,
      steps: [],
    });
    const out = result?.messages as Array<{ providerOptions?: Record<string, unknown> }>;
    expect(out).toBeDefined();
    expect(out[0]?.providerOptions).toBeUndefined();
    expect(out[1]?.providerOptions).toEqual({ anthropic: { cacheControl: { type: "ephemeral" } } });
  });

  it("the wired callback returns undefined for non-finish-step parts", async () => {
    const captured: unknown[] = [];
    vi.mocked(streamText).mockReturnValue(makeStreamResult({ metadataCalls: captured }) as never);
    const { stream } = makeWritable();

    await runAgentStep({ ...baseInput, writable: stream } as never);

    const cb = captured[0] as (args: { part: { type: string } }) => unknown;
    expect(cb({ part: { type: "text-delta" } })).toBeUndefined();
    expect(cb({ part: { type: "start" } })).toBeUndefined();
  });

  it("wires an onFinish callback into toUIMessageStream", async () => {
    const onFinishCalls: unknown[] = [];
    vi.mocked(streamText).mockReturnValue(makeStreamResult({ onFinishCalls }) as never);
    const { stream } = makeWritable();

    await runAgentStep({ ...baseInput, writable: stream } as never);

    expect(onFinishCalls).toHaveLength(1);
    expect(typeof onFinishCalls[0]).toBe("function");
  });

  it("returns the responseMessage captured from onFinish", async () => {
    const emittedResponseMessage = {
      id: "assistant-msg-1",
      role: "assistant",
      parts: [{ type: "text", text: "Hello" }],
    };
    vi.mocked(streamText).mockReturnValue(makeStreamResult({ emittedResponseMessage }) as never);
    const { stream } = makeWritable();

    const result = await runAgentStep({ ...baseInput, writable: stream } as never);

    expect(result.responseMessage).toEqual(emittedResponseMessage);
    expect(result.finishReason).toBe("stop");
  });

  it("returns responseMessage: undefined when onFinish never fires", async () => {
    // Default makeStreamResult — no emittedResponseMessage, so onFinish is wired but never invoked
    vi.mocked(streamText).mockReturnValue(makeStreamResult() as never);
    const { stream } = makeWritable();

    const result = await runAgentStep({ ...baseInput, writable: stream } as never);

    expect(result.responseMessage).toBeUndefined();
    expect(result.finishReason).toBe("stop");
  });

  it("forwards input.assistantMessageId into toUIMessageStream's generateMessageId", async () => {
    const generateMessageIdCalls: unknown[] = [];
    const streamResult = makeStreamResult();
    // Spy on the options passed to toUIMessageStream to grab the generateMessageId fn.
    const originalToUIMessageStream = streamResult.toUIMessageStream;
    streamResult.toUIMessageStream = vi.fn((streamOpts: { generateMessageId?: unknown }) => {
      generateMessageIdCalls.push(streamOpts.generateMessageId);
      return (originalToUIMessageStream as unknown as (o: unknown) => AsyncGenerator<unknown>)(
        streamOpts,
      );
    }) as never;
    vi.mocked(streamText).mockReturnValue(streamResult as never);
    const { stream } = makeWritable();

    await runAgentStep({
      ...baseInput,
      writable: stream,
      assistantMessageId: "asst-from-workflow-xyz",
    } as never);

    expect(generateMessageIdCalls).toHaveLength(1);
    const gen = generateMessageIdCalls[0] as () => string;
    expect(typeof gen).toBe("function");
    expect(gen()).toBe("asst-from-workflow-xyz");
  });
});
