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

// Default: getRun(...).status resolves to "running" — natural-completion
// tests pass; user-abort tests override per-case.
vi.mock("workflow/api", () => ({
  getRun: vi.fn(() => ({
    get status() {
      return Promise.resolve("running");
    },
    cancel: vi.fn(() => Promise.resolve()),
  })),
}));

type StreamOpts = {
  messageMetadata?: unknown;
  generateMessageId?: unknown;
  originalMessages?: unknown[];
  onFinish?: (e: { responseMessage: unknown }) => unknown;
};

function makeStreamResult(opts?: {
  metadataCalls?: Array<unknown>;
  generateIdCalls?: Array<unknown>;
  streamOptsOut?: Array<StreamOpts>;
  emitResponseMessage?: unknown;
}) {
  const calls = opts?.metadataCalls ?? [];
  const genCalls = opts?.generateIdCalls ?? [];
  return {
    toUIMessageStream: vi.fn((streamOpts: StreamOpts) => {
      // Capture the callbacks so tests can inspect them.
      calls.push(streamOpts.messageMetadata);
      genCalls.push(streamOpts.generateMessageId);
      opts?.streamOptsOut?.push(streamOpts);
      return (async function* () {
        yield { type: "text-start", id: "t1" };
        yield { type: "text-end", id: "t1" };
        if (opts && "emitResponseMessage" in opts) {
          streamOpts.onFinish?.({ responseMessage: opts.emitResponseMessage });
        }
      })();
    }),
    finishReason: Promise.resolve("stop"),
    response: Promise.resolve({ messages: [] }),
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
  // The workflow body now owns conversion and threading, so the step takes
  // model messages directly plus the UI message it is appending to.
  modelMessages: [{ role: "user" as const, content: "hi" }],
  originalMessages: [
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
  beforeEach(() => vi.clearAllMocks());

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

  // With one model call per step there is no in-call step boundary left for
  // `prepareStep` to hook, so cacheControl is applied to the messages handed
  // to streamText directly.
  it("marks the last model message with cacheControl before passing it to streamText", async () => {
    vi.mocked(streamText).mockReturnValue(makeStreamResult() as never);
    const { stream } = makeWritable();

    await runAgentStep({
      ...baseInput,
      modelMessages: [
        { role: "user", content: "first" },
        { role: "user", content: "second" },
      ],
      writable: stream,
    } as never);

    const args = vi.mocked(streamText).mock.calls[0]?.[0] as {
      prepareStep?: unknown;
      messages: Array<{ providerOptions?: Record<string, unknown> }>;
    };
    expect(args.prepareStep).toBeUndefined();
    expect(args.messages[0]?.providerOptions).toBeUndefined();
    expect(args.messages[1]?.providerOptions).toEqual({
      anthropic: { cacheControl: { type: "ephemeral" } },
    });
  });

  // The decomposition contract: one model call per step. If a `stopWhen`
  // creeps back in, the step regrows past Vercel's 800 s ceiling and the
  // duplicate-email failure returns (chat#1918).
  it("does NOT set stopWhen, so the AI SDK default bounds the step to one model call", async () => {
    vi.mocked(streamText).mockReturnValue(makeStreamResult() as never);
    const { stream } = makeWritable();

    await runAgentStep({ ...baseInput, writable: stream } as never);

    const args = vi.mocked(streamText).mock.calls[0]?.[0] as { stopWhen?: unknown };
    expect(args.stopWhen).toBeUndefined();
  });

  it("suppresses per-iteration start/finish chunks so the turn renders as one message", async () => {
    const streamOpts: Array<{ sendStart?: boolean; sendFinish?: boolean }> = [];
    vi.mocked(streamText).mockReturnValue({
      toUIMessageStream: vi.fn((opts: { sendStart?: boolean; sendFinish?: boolean }) => {
        streamOpts.push(opts);
        return (async function* () {})();
      }),
      finishReason: Promise.resolve("stop"),
      response: Promise.resolve({ messages: [] }),
    } as never);
    const { stream } = makeWritable();

    await runAgentStep({ ...baseInput, writable: stream } as never);

    expect(streamOpts[0]?.sendStart).toBe(false);
    expect(streamOpts[0]?.sendFinish).toBe(false);
  });

  it("returns responseMessages so the workflow can thread them into the next iteration", async () => {
    const produced = [{ role: "assistant", content: "tool call" }];
    vi.mocked(streamText).mockReturnValue({
      toUIMessageStream: vi.fn(() => (async function* () {})()),
      finishReason: Promise.resolve("tool-calls"),
      response: Promise.resolve({ messages: produced }),
    } as never);
    const { stream } = makeWritable();

    const result = await runAgentStep({ ...baseInput, writable: stream } as never);

    expect(result.responseMessages).toEqual(produced);
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
    vi.mocked(streamText).mockReturnValue(
      makeStreamResult({ emitResponseMessage: emitted }) as never,
    );
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

  describe("natural-completion path", () => {
    it("returns aborted: false on natural finish (poller never fires)", async () => {
      // Default poller mock: never aborts.
      vi.mocked(streamText).mockReturnValue(makeStreamResult() as never);
      const { stream } = makeWritable();

      const result = await runAgentStep({ ...baseInput, writable: stream } as never);

      // The crucial check: even though runAgentStep's finally calls
      // cancelController.abort() unconditionally to stop the poller, that
      // must NOT make natural completions look like user-stops — otherwise
      // runAgentWorkflow would skip billing + auto-commit on every turn.
      expect(result.aborted).toBe(false);
    });

    it("uses the real finishReason from streamText on natural completion", async () => {
      vi.mocked(streamText).mockReturnValue({
        toUIMessageStream: vi.fn(() =>
          (async function* () {
            yield { type: "start" };
            yield { type: "finish" };
          })(),
        ),
        finishReason: Promise.resolve("length"),
        response: Promise.resolve({ messages: [] }),
      } as never);
      const { stream } = makeWritable();

      const result = await runAgentStep({ ...baseInput, writable: stream } as never);

      expect(result.aborted).toBe(false);
      expect(result.finishReason).toBe("length");
    });
  });
});
