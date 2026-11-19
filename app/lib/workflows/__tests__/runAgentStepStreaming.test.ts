import { describe, it, expect, vi, beforeEach } from "vitest";
import { streamText } from "ai";
import { FatalError } from "workflow";
import { getRun } from "workflow/api";
import { pollWorkflowCancellation } from "@/lib/chat/pollWorkflowCancellation";
import { runAgentStep } from "@/app/lib/workflows/runAgentStep";
import { persistAssistantMessage } from "@/lib/chat/persistAssistantMessage";

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return { ...actual, streamText: vi.fn() };
});
vi.mock("@ai-sdk/gateway", () => ({
  gateway: vi.fn((modelId: string) => ({ modelId, __mock: "gateway" })),
}));
vi.mock("@/lib/chat/persistAssistantMessage", () => ({
  persistAssistantMessage: vi.fn(),
}));
vi.mock("workflow", async () => ({
  FatalError: (await vi.importActual<typeof import("workflow")>("workflow")).FatalError,
  getWorkflowMetadata: vi.fn(() => ({
    workflowRunId: "test-run-id",
    workflowName: "test",
    workflowStartedAt: new Date(0),
    url: "https://example.test",
  })),
}));
vi.mock("@/lib/chat/pollWorkflowCancellation", () => ({
  pollWorkflowCancellation: vi.fn(() => ({ stop: vi.fn(), done: Promise.resolve() })),
}));
vi.mock("workflow/api", () => ({
  getRun: vi.fn(() => ({
    get status() {
      return Promise.resolve("running");
    },
  })),
}));

const baseInput = {
  modelMessages: [{ role: "user" as const, content: "hi" }],
  originalMessages: [
    { id: "m1", role: "user" as const, parts: [{ type: "text" as const, text: "hi" }] },
  ],
  modelId: "anthropic/claude-haiku-4.5",
  agentContext: {
    sandbox: { state: { type: "vercel" }, workingDirectory: "/sandbox/mono" },
  },
  assistantMessageId: "asst-test-id",
};

function makeWritable() {
  const written: unknown[] = [];
  const stream = new WritableStream({
    write(chunk) {
      written.push(chunk);
    },
  });
  return { stream, written };
}

beforeEach(() => vi.clearAllMocks());

describe("runAgentStep — streaming shape (mirrors upstream open-agents)", () => {
  it("writes every stream part straight to the shared writable", async () => {
    const parts = [
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", delta: "hello" },
      { type: "text-end", id: "t1" },
    ];
    vi.mocked(streamText).mockReturnValue({
      toUIMessageStream: vi.fn(() =>
        (async function* () {
          for (const p of parts) yield p;
        })(),
      ),
      finishReason: Promise.resolve("stop"),
      response: Promise.resolve({ messages: [] }),
    } as never);
    const { stream, written } = makeWritable();

    await runAgentStep({ ...baseInput, writable: stream } as never);

    expect(written).toEqual(parts);
  });

  // Persistence moved to the workflow body. Keeping it in the step is what
  // required the outer createUIMessageStream wrapper, and that wrapper is
  // what dropped every tool call from the transcript (chat#1918).
  it("does not persist from inside the step", async () => {
    vi.mocked(streamText).mockReturnValue({
      toUIMessageStream: vi.fn(() => (async function* () {})()),
      finishReason: Promise.resolve("stop"),
      response: Promise.resolve({ messages: [] }),
    } as never);
    const { stream } = makeWritable();

    await runAgentStep({ ...baseInput, writable: stream } as never);

    expect(persistAssistantMessage).not.toHaveBeenCalled();
  });

  it("reports aborted and does not rethrow when the stream aborts", async () => {
    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
    vi.mocked(streamText).mockReturnValue({
      toUIMessageStream: vi.fn(() =>
        (async function* () {
          yield { type: "text-start", id: "t1" };
          throw abortError;
        })(),
      ),
      finishReason: Promise.reject(abortError),
      response: Promise.reject(abortError),
    } as never);
    const { stream } = makeWritable();

    const result = await runAgentStep({ ...baseInput, writable: stream } as never);

    expect(result.aborted).toBe(true);
    expect(result.finishReason).toBe("stop");
    expect(result.responseMessages).toEqual([]);
  });
});

describe("retained structured stream output", () => {
  const safePart = { type: "text-delta", id: "t1", delta: "already emitted independent text" };
  const markedPart = {
    type: "tool-output-available",
    toolCallId: "source-call",
    output: { rows: [{ mode: "retained_field" }], sibling: "PRIVATE-SIBLING-987654321" },
  };
  const markedMessage = {
    id: "assistant",
    role: "assistant",
    parts: [
      {
        type: "tool-source",
        toolCallId: "source-call",
        state: "output-available",
        input: {},
        output: markedPart.output,
      },
    ],
  };

  it.each(["running", "cancelled", "poller-aborted"])(
    "withholds the whole marked part and refuses rather than returning output when run is %s",
    async status => {
      vi.mocked(getRun).mockReturnValue({ status: Promise.resolve(status) } as never);
      if (status === "poller-aborted") {
        vi.mocked(pollWorkflowCancellation).mockImplementationOnce((_runId, controller) => {
          controller.abort();
          return { stop: vi.fn(), done: Promise.resolve() };
        });
      }
      let signal: AbortSignal | undefined;
      const finish = vi.fn();
      vi.mocked(streamText).mockImplementation(options => {
        signal = options.abortSignal;
        // Reject after denial cleanup aborts the provider, as streamText can do.
        const rejectOnAbort = () =>
          new Promise<never>((_resolve, reject) => {
            const fail = () =>
              reject(Object.assign(new Error("provider aborted"), { name: "AbortError" }));
            if (signal?.aborted) queueMicrotask(fail);
            else signal?.addEventListener("abort", fail, { once: true });
          });
        return {
          toUIMessageStream: (opts: { onFinish: (event: unknown) => void }) =>
            (async function* () {
              try {
                yield safePart;
                yield markedPart;
                yield { type: "text-delta", id: "t1", delta: "later output" };
              } finally {
                // SDK cancellation may finish its accumulated message, including withheld data.
                finish();
                opts.onFinish({ responseMessage: markedMessage });
              }
            })(),
          finishReason: rejectOnAbort(),
          response: rejectOnAbort(),
        } as never;
      });
      const { stream, written } = makeWritable();
      const close = vi.spyOn(stream, "close");
      const abort = vi.spyOn(stream, "abort");
      const result = runAgentStep({ ...baseInput, writable: stream } as never);
      await expect(result).rejects.toBeInstanceOf(FatalError);
      await expect(result).rejects.toThrow(/^Retained-field model input unavailable$/);
      expect(written).toEqual([safePart]);
      expect(JSON.stringify(written)).not.toContain("PRIVATE-SIBLING");
      expect(finish).toHaveBeenCalledOnce();
      expect(stream.locked).toBe(false);
      expect(close).not.toHaveBeenCalled();
      expect(abort).not.toHaveBeenCalled();
      expect(signal?.aborted).toBe(true);
      expect(
        vi.mocked(pollWorkflowCancellation).mock.results.at(-1)?.value.stop,
      ).toHaveBeenCalledOnce();
      expect(persistAssistantMessage).not.toHaveBeenCalled();
    },
  );

  it("refuses a marked accumulated onFinish message even during cancellation", async () => {
    vi.mocked(getRun).mockReturnValue({ status: Promise.resolve("cancelled") } as never);
    vi.mocked(streamText).mockReturnValue({
      toUIMessageStream: (opts: { onFinish: (event: unknown) => void }) =>
        (async function* () {
          yield safePart;
          opts.onFinish({ responseMessage: markedMessage });
          throw Object.assign(new Error("stopped"), { name: "AbortError" });
        })(),
      finishReason: Promise.resolve("stop"),
      response: Promise.resolve({ messages: [] }),
    } as never);
    const { stream, written } = makeWritable();
    await expect(runAgentStep({ ...baseInput, writable: stream } as never)).rejects.toThrow(
      "Retained-field model input unavailable",
    );
    expect(written).toEqual([safePart]);
  });

  it("preserves an unmarked tool output and its completed message", async () => {
    const part = { type: "tool-output-available", toolCallId: "safe", output: { total: 7 } };
    const message = {
      id: "assistant",
      role: "assistant",
      parts: [
        {
          type: "tool-source",
          toolCallId: "safe",
          state: "output-available",
          input: {},
          output: part.output,
        },
      ],
    };
    const modelMessages = [
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "safe",
            toolName: "source",
            output: { type: "json", value: part.output },
          },
        ],
      },
    ];
    vi.mocked(streamText).mockReturnValue({
      toUIMessageStream: (opts: { onFinish: (event: unknown) => void }) =>
        (async function* () {
          yield part;
          opts.onFinish({ responseMessage: message });
        })(),
      finishReason: Promise.resolve("tool-calls"),
      response: Promise.resolve({ messages: modelMessages }),
    } as never);
    const { stream, written } = makeWritable();
    const result = await runAgentStep({ ...baseInput, writable: stream } as never);
    expect(written).toEqual([part]);
    expect(result).toEqual({
      finishReason: "tool-calls",
      responseMessage: message,
      responseMessages: modelMessages,
      aborted: false,
    });
  });
});
