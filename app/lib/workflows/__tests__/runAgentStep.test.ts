import { describe, it, expect, vi, beforeEach } from "vitest";
import { streamText, createUIMessageStream } from "ai";
import { runAgentStep } from "@/app/lib/workflows/runAgentStep";
import { persistAssistantMessage } from "@/lib/chat/persistAssistantMessage";

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return { ...actual, streamText: vi.fn(), createUIMessageStream: vi.fn() };
});

// Avoid pulling in real gateway / fetch surface.
vi.mock("@ai-sdk/gateway", () => ({
  gateway: vi.fn((modelId: string) => ({ modelId, __mock: "gateway" })),
}));

vi.mock("@/lib/chat/persistAssistantMessage", () => ({
  persistAssistantMessage: vi.fn(),
}));

// runAgentStep now reads workflowRunId via getWorkflowMetadata() and polls
// getRun(runId).status to source its abort signal. Stub both so the tests
// don't pull in the workflow runtime.
vi.mock("workflow", () => ({
  getWorkflowMetadata: vi.fn(() => ({
    workflowRunId: "test-run-id",
    workflowName: "test",
    workflowStartedAt: new Date(0),
    url: "https://example.test",
  })),
}));

vi.mock("@/lib/chat/pollWorkflowCancellation", () => ({
  pollWorkflowCancellation: vi.fn(() => ({
    stop: vi.fn(),
    done: Promise.resolve(),
  })),
}));

// Captures the options runAgentStep passes to createUIMessageStream so
// tests can drive its onStepFinish / onFinish callbacks directly.
type CreateOpts = {
  generateId?: () => string;
  onStepFinish?: (e: { responseMessage: unknown }) => unknown;
  onFinish?: (e: { responseMessage: unknown }) => unknown;
  execute?: (a: { writer: { write: () => void; merge: () => void; onError: undefined } }) => void;
};
let capturedCreateOpts: CreateOpts;

function makeStreamResult(opts?: {
  metadataCalls?: Array<unknown>;
  generateIdCalls?: Array<unknown>;
}) {
  const calls = opts?.metadataCalls ?? [];
  const genCalls = opts?.generateIdCalls ?? [];
  return {
    toUIMessageStream: vi.fn(
      (streamOpts: { messageMetadata?: unknown; generateMessageId?: unknown }) => {
        // Capture the callbacks so tests can inspect them.
        calls.push(streamOpts.messageMetadata);
        genCalls.push(streamOpts.generateMessageId);
        return (async function* () {
          yield { type: "start" };
          yield { type: "finish" };
        })();
      },
    ),
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
  chatId: "chat-1",
  agentContext: {
    sandbox: { state: { type: "vercel" }, workingDirectory: "/sandbox/mono" },
  },
  assistantMessageId: "asst-test-id",
};

describe("runAgentStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: capture the options, run execute (so toUIMessageStream — and
    // its messageMetadata callback — is exercised), and return an empty
    // stream that closes immediately so pipeTo resolves.
    vi.mocked(createUIMessageStream).mockImplementation((opts: never) => {
      capturedCreateOpts = opts as CreateOpts;
      capturedCreateOpts.execute?.({
        writer: { write: () => {}, merge: () => {}, onError: undefined },
      });
      return new ReadableStream({
        start(controller) {
          controller.close();
        },
      }) as never;
    });
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
    vi.mocked(streamText).mockReturnValue(makeStreamResult() as never);
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
    vi.mocked(streamText).mockReturnValue(makeStreamResult() as never);
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
    vi.mocked(streamText).mockReturnValue(makeStreamResult() as never);
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

  it("persists the assistant message on each step via onStepFinish", async () => {
    vi.mocked(streamText).mockReturnValue(makeStreamResult() as never);
    const { stream } = makeWritable();

    await runAgentStep({ ...baseInput, writable: stream } as never);

    const msg = { id: "a1", role: "assistant", parts: [{ type: "text", text: "partial" }] };
    await capturedCreateOpts.onStepFinish?.({ responseMessage: msg });

    expect(persistAssistantMessage).toHaveBeenCalledWith("chat-1", msg);
  });

  it("persists the final assistant message via onFinish", async () => {
    vi.mocked(streamText).mockReturnValue(makeStreamResult() as never);
    const { stream } = makeWritable();

    await runAgentStep({ ...baseInput, writable: stream } as never);

    const msg = { id: "a1", role: "assistant", parts: [{ type: "text", text: "done" }] };
    await capturedCreateOpts.onFinish?.({ responseMessage: msg });

    expect(persistAssistantMessage).toHaveBeenCalledWith("chat-1", msg);
  });

  it("forwards assistantMessageId into toUIMessageStream's generateMessageId (stable row id)", async () => {
    const generateIdCalls: unknown[] = [];
    vi.mocked(streamText).mockReturnValue(makeStreamResult({ generateIdCalls }) as never);
    const { stream } = makeWritable();

    await runAgentStep({
      ...baseInput,
      writable: stream,
      assistantMessageId: "asst-from-workflow-xyz",
    } as never);

    expect(generateIdCalls).toHaveLength(1);
    const gen = generateIdCalls[0] as () => string;
    expect(typeof gen).toBe("function");
    expect(gen()).toBe("asst-from-workflow-xyz");
  });

  it("sets a stable generateId on the createUIMessageStream", async () => {
    vi.mocked(streamText).mockReturnValue(makeStreamResult() as never);
    const { stream } = makeWritable();

    await runAgentStep({
      ...baseInput,
      writable: stream,
      assistantMessageId: "asst-from-workflow-xyz",
    } as never);

    expect(typeof capturedCreateOpts.generateId).toBe("function");
    expect(capturedCreateOpts.generateId!()).toBe("asst-from-workflow-xyz");
  });

  it("returns the finishReason from the model result", async () => {
    vi.mocked(streamText).mockReturnValue(makeStreamResult() as never);
    const { stream } = makeWritable();

    const result = await runAgentStep({ ...baseInput, writable: stream } as never);

    expect(result.finishReason).toBe("stop");
  });

  it("returns the responseMessage captured from onFinish (so the workflow can charge credits)", async () => {
    const emitted = {
      id: "asst-test-id",
      role: "assistant",
      parts: [{ type: "text", text: "Hello" }],
      metadata: { totalMessageCost: 0.05 },
    };
    vi.mocked(streamText).mockReturnValue(makeStreamResult() as never);
    vi.mocked(createUIMessageStream).mockImplementation((opts: never) => {
      const o = opts as CreateOpts;
      o.execute?.({ writer: { write: () => {}, merge: () => {}, onError: undefined } });
      // Drive onFinish so runAgentStep captures the final message.
      void o.onFinish?.({ responseMessage: emitted });
      return new ReadableStream({
        start(controller) {
          controller.close();
        },
      }) as never;
    });
    const { stream } = makeWritable();

    const result = await runAgentStep({ ...baseInput, writable: stream } as never);

    expect(result.responseMessage).toEqual(emitted);
  });

  it("returns responseMessage: undefined when onFinish never fires", async () => {
    // Default mock never invokes onFinish.
    vi.mocked(streamText).mockReturnValue(makeStreamResult() as never);
    const { stream } = makeWritable();

    const result = await runAgentStep({ ...baseInput, writable: stream } as never);

    expect(result.responseMessage).toBeUndefined();
  });
});
