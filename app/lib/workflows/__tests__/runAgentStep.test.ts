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

function makeStreamResult(opts?: { metadataCalls?: Array<unknown> }) {
  const calls = opts?.metadataCalls ?? [];
  return {
    toUIMessageStream: vi.fn((streamOpts: { messageMetadata?: unknown }) => {
      // Capture the callback so tests can inspect it
      calls.push(streamOpts.messageMetadata);
      return (async function* () {
        yield { type: "start" };
        yield { type: "finish" };
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
});
