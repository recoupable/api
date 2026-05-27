import { describe, it, expect, vi, beforeEach } from "vitest";
import { taskTool, type TaskToolOutput } from "@/lib/agent/tools/taskTool";
import { streamText } from "ai";
import { connectVercel } from "@/lib/sandbox/vercel/connect/connectVercel";

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return { ...actual, streamText: vi.fn() };
});

vi.mock("@/lib/sandbox/vercel/connect/connectVercel", () => ({
  connectVercel: vi.fn(),
}));

const mainModel = { modelId: "anthropic/claude-haiku-4.5" } as never;
const subagentModelOverride = { modelId: "anthropic/claude-sonnet-4.6" } as never;
const ctx = {
  sandbox: { state: { sandboxName: "x" }, workingDirectory: "/sandbox/mono" },
  model: mainModel,
};

function makeStreamResult(opts: {
  toolCalls?: Array<{ toolName: string; input: unknown }>;
  finishSteps?: number;
  responseMessages?: Array<{ role: string; content: unknown }>;
  totalUsage?: unknown;
}) {
  const calls = opts.toolCalls ?? [];
  const finishCount = opts.finishSteps ?? 1;
  return {
    fullStream: (async function* () {
      for (const c of calls) {
        yield { type: "tool-call", toolName: c.toolName, input: c.input };
      }
      for (let i = 0; i < finishCount; i++) {
        yield {
          type: "finish-step",
          usage: { inputTokens: 100, outputTokens: 25, totalTokens: 125 },
        };
      }
    })(),
    response: Promise.resolve({ messages: opts.responseMessages ?? [] }),
    totalUsage: Promise.resolve(opts.totalUsage ?? { inputTokens: 0, outputTokens: 0 }),
    finishReason: Promise.resolve("stop"),
  };
}

async function drainGenerator<T>(gen: AsyncGenerator<T> | AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const chunk of gen) out.push(chunk);
  return out;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(connectVercel).mockResolvedValue({ workingDirectory: "/sandbox/mono" } as never);
});

describe("taskTool.execute (async generator)", () => {
  it("yields an initial chunk with toolCallCount=0 + startedAt + modelId before the subagent does any work", async () => {
    vi.mocked(streamText).mockReturnValue(makeStreamResult({}) as never);
    const gen = taskTool.execute!({ task: "x", instructions: "y" }, {
      experimental_context: ctx,
    } as never) as AsyncGenerator<TaskToolOutput>;
    const first = await gen.next();
    expect(first.done).toBe(false);
    expect(first.value).toMatchObject({
      toolCallCount: 0,
      modelId: "anthropic/claude-haiku-4.5",
    });
    expect(first.value.startedAt).toBeTypeOf("number");
    // Drain to finish.
    await drainGenerator(gen);
  });

  it("emits a `pending` chunk with name + input on every tool-call", async () => {
    vi.mocked(streamText).mockReturnValue(
      makeStreamResult({
        toolCalls: [
          { toolName: "bash", input: { command: "ls" } },
          { toolName: "read", input: { path: "/foo" } },
        ],
        finishSteps: 1,
        responseMessages: [{ role: "assistant", content: [{ type: "text", text: "done" }] }],
      }) as never,
    );
    const chunks = (await drainGenerator(
      taskTool.execute!({ task: "x", instructions: "y" }, {
        experimental_context: ctx,
      } as never) as AsyncGenerator<TaskToolOutput>,
    )) as TaskToolOutput[];
    // Two tool-call yields + one finish-step yield (sticky pending so the
    // UI doesn't flicker back to an initializing state between steps).
    const pendingChunks = chunks.filter(c => c.pending);
    expect(pendingChunks).toHaveLength(3);
    expect(pendingChunks[0]?.pending).toEqual({ name: "bash", input: { command: "ls" } });
    expect(pendingChunks[0]?.toolCallCount).toBe(1);
    expect(pendingChunks[1]?.pending).toEqual({ name: "read", input: { path: "/foo" } });
    expect(pendingChunks[1]?.toolCallCount).toBe(2);
    // Finish-step keeps the most recent pending sticky.
    expect(pendingChunks[2]?.pending).toEqual({ name: "read", input: { path: "/foo" } });
  });

  it("accumulates usage across finish-step parts", async () => {
    vi.mocked(streamText).mockReturnValue(
      makeStreamResult({
        finishSteps: 2,
        responseMessages: [{ role: "assistant", content: [{ type: "text", text: "ok" }] }],
      }) as never,
    );
    const chunks = (await drainGenerator(
      taskTool.execute!({ task: "x", instructions: "y" }, {
        experimental_context: ctx,
      } as never) as AsyncGenerator<TaskToolOutput>,
    )) as TaskToolOutput[];
    const usageChunks = chunks.filter(c => c.usage);
    // 2 finish-step yields + 1 final yield = 3 chunks carrying usage
    expect(usageChunks.length).toBeGreaterThanOrEqual(2);
    const last = usageChunks[usageChunks.length - 1]!;
    expect(last.usage).toMatchObject({ inputTokens: 200, outputTokens: 50 });
  });

  it("emits a final chunk containing the subagent's full response.messages transcript", async () => {
    const responseMessages = [
      { role: "assistant", content: [{ type: "tool-call", toolName: "bash" }] },
      { role: "tool", content: [{ type: "tool-result", output: "..." }] },
      { role: "assistant", content: [{ type: "text", text: "Done." }] },
    ];
    vi.mocked(streamText).mockReturnValue(makeStreamResult({ responseMessages }) as never);
    const chunks = (await drainGenerator(
      taskTool.execute!({ task: "x", instructions: "y" }, {
        experimental_context: ctx,
      } as never) as AsyncGenerator<TaskToolOutput>,
    )) as TaskToolOutput[];
    const finalChunk = chunks.find(c => c.final);
    expect(finalChunk).toBeDefined();
    expect(finalChunk!.final).toEqual(responseMessages);
    expect(finalChunk!.toolCallCount).toBe(0);
    expect(finalChunk!.usage).toBeDefined();
  });

  it("uses the subagentModel override when set on the agent context", async () => {
    vi.mocked(streamText).mockReturnValue(makeStreamResult({}) as never);
    await drainGenerator(
      taskTool.execute!({ task: "x", instructions: "y" }, {
        experimental_context: { ...ctx, subagentModel: subagentModelOverride },
      } as never) as AsyncGenerator<TaskToolOutput>,
    );
    const args = vi.mocked(streamText).mock.calls[0]?.[0] as { model: unknown };
    expect(args.model).toBe(subagentModelOverride);
  });

  it("throws when agent context is missing the `model` field", async () => {
    const gen = taskTool.execute!({ task: "x", instructions: "y" }, {
      experimental_context: { sandbox: ctx.sandbox /* no model */ },
    } as never) as AsyncGenerator<TaskToolOutput>;
    await expect(gen.next()).rejects.toThrow(/model not initialized/i);
  });

  it("registers only the executor tool set on the inner streamText call", async () => {
    vi.mocked(streamText).mockReturnValue(makeStreamResult({}) as never);
    await drainGenerator(
      taskTool.execute!({ task: "x", instructions: "y" }, {
        experimental_context: ctx,
      } as never) as AsyncGenerator<TaskToolOutput>,
    );
    const args = vi.mocked(streamText).mock.calls[0]?.[0] as { tools: Record<string, unknown> };
    expect(Object.keys(args.tools).sort()).toEqual([
      "bash",
      "edit",
      "glob",
      "grep",
      "read",
      "write",
    ]);
  });

  it("passes a non-empty prompt so the model has something to act on (NoOutputGeneratedError regression)", async () => {
    vi.mocked(streamText).mockReturnValue(makeStreamResult({}) as never);
    await drainGenerator(
      taskTool.execute!({ task: "x", instructions: "y" }, {
        experimental_context: ctx,
      } as never) as AsyncGenerator<TaskToolOutput>,
    );
    const args = vi.mocked(streamText).mock.calls[0]?.[0] as {
      prompt?: string;
      messages?: unknown[];
    };
    const hasPrompt = typeof args.prompt === "string" && args.prompt.length > 0;
    const hasMessages = Array.isArray(args.messages) && args.messages.length > 0;
    expect(hasPrompt || hasMessages).toBe(true);
  });
});

describe("taskTool.toModelOutput", () => {
  it("returns 'Task completed.' when no `final` is present", () => {
    const out = taskTool.toModelOutput!({ output: {} } as never);
    expect(out).toEqual({ type: "text", value: "Task completed." });
  });

  it("extracts the last assistant text part from the transcript", () => {
    const out = taskTool.toModelOutput!({
      output: {
        final: [
          { role: "assistant", content: [{ type: "tool-call", toolName: "bash" }] },
          { role: "tool", content: [{ type: "tool-result" }] },
          {
            role: "assistant",
            content: [
              { type: "tool-call", toolName: "read" },
              { type: "text", text: "Found 3 files." },
            ],
          },
        ],
      },
    } as never);
    expect(out).toEqual({ type: "text", value: "Found 3 files." });
  });

  it("handles a string-valued content directly", () => {
    const out = taskTool.toModelOutput!({
      output: { final: [{ role: "assistant", content: "plain text reply" }] },
    } as never);
    expect(out).toEqual({ type: "text", value: "plain text reply" });
  });

  it("falls back to 'Task completed.' when the last assistant message has no text parts", () => {
    const out = taskTool.toModelOutput!({
      output: {
        final: [{ role: "assistant", content: [{ type: "tool-call", toolName: "bash" }] }],
      },
    } as never);
    expect(out).toEqual({ type: "text", value: "Task completed." });
  });
});
