import { describe, it, expect, vi, beforeEach } from "vitest";
import { streamText } from "ai";
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
vi.mock("workflow", () => ({
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
