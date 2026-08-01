import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAgentWorkflow } from "@/app/lib/workflows/runAgentWorkflow";
import { runAgentStep } from "@/app/lib/workflows/runAgentStep";
import { convertMessagesStep } from "@/app/lib/workflows/convertMessagesStep";
import { sendStreamStart } from "@/app/lib/workflows/sendStreamStart";
import { sendStreamFinish } from "@/app/lib/workflows/sendStreamFinish";
import { generateAssistantMessageId } from "@/app/lib/workflows/generateAssistantMessageId";
import { persistAssistantMessageStep } from "@/app/lib/workflows/persistAssistantMessageStep";
import { CHAT_AGENT_MAX_ITERATIONS } from "@/lib/chat/const";

vi.mock("@/app/lib/workflows/runAgentStep", () => ({ runAgentStep: vi.fn() }));
vi.mock("@/app/lib/workflows/convertMessagesStep", () => ({ convertMessagesStep: vi.fn() }));
vi.mock("@/app/lib/workflows/persistAssistantMessageStep", () => ({
  persistAssistantMessageStep: vi.fn(),
}));
vi.mock("@/app/lib/workflows/sendStreamStart", () => ({ sendStreamStart: vi.fn() }));
vi.mock("@/app/lib/workflows/sendStreamFinish", () => ({ sendStreamFinish: vi.fn() }));
vi.mock("@/app/lib/workflows/generateAssistantMessageId", () => ({
  generateAssistantMessageId: vi.fn(),
}));
vi.mock("@/app/lib/workflows/deleteEphemeralKeyStep", () => ({
  deleteEphemeralKeyStep: vi.fn(),
}));
vi.mock("@/app/lib/workflows/closeChatStream", () => ({ closeChatStream: vi.fn() }));
vi.mock("@/lib/chat/clearChatActiveStream", () => ({ clearChatActiveStream: vi.fn() }));
vi.mock("@/lib/credits/handleChatCredits", () => ({ handleChatCredits: vi.fn() }));
vi.mock("@/lib/chat/auto-commit/autoCommitChatTurn", () => ({ autoCommitChatTurn: vi.fn() }));

const writableStub = new WritableStream();
vi.mock("workflow", () => ({
  getWritable: vi.fn(() => writableStub),
  getWorkflowMetadata: vi.fn(() => ({
    workflowRunId: "wrun_loop_test",
    workflowName: "runAgentWorkflow",
    workflowStartedAt: new Date(0),
    url: "https://example.invalid/workflow",
  })),
}));

const baseInput = {
  messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] } as never],
  chatId: "chat-1",
  sessionId: "session-1",
  accountId: "acc-1",
  modelId: "anthropic/claude-haiku-4.5",
  agentContext: {
    sandbox: { state: { type: "vercel" }, workingDirectory: "/sandbox/mono" },
  } as never,
};

/** An assistant message carrying `n` parts, used to assert threading. */
const assistantMessage = (id: string) =>
  ({ id, role: "assistant", parts: [{ type: "text", text: id }] }) as never;

/** Queue a sequence of runAgentStep results, one per loop iteration. */
function queueSteps(results: Array<Record<string, unknown>>) {
  const mocked = vi.mocked(runAgentStep);
  results.forEach(r => mocked.mockResolvedValueOnce(r as never));
  // Anything beyond the queued results ends the loop, so a bug that
  // over-iterates fails on a count assertion rather than hanging.
  mocked.mockResolvedValue({
    finishReason: "stop",
    aborted: false,
    responseMessage: undefined,
    responseMessages: [],
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(generateAssistantMessageId).mockResolvedValue("asst-loop-id");
  vi.mocked(convertMessagesStep).mockResolvedValue([{ role: "user", content: "hi" }] as never);
});

describe("runAgentWorkflow — per-iteration agent loop", () => {
  it("keeps iterating while a step finishes on tool-calls, and stops once it finishes on stop", async () => {
    queueSteps([
      {
        finishReason: "tool-calls",
        aborted: false,
        responseMessage: assistantMessage("a1"),
        responseMessages: [{ role: "assistant", content: "call-1" }],
      },
      {
        finishReason: "tool-calls",
        aborted: false,
        responseMessage: assistantMessage("a2"),
        responseMessages: [{ role: "assistant", content: "call-2" }],
      },
      {
        finishReason: "stop",
        aborted: false,
        responseMessage: assistantMessage("a3"),
        responseMessages: [{ role: "assistant", content: "done" }],
      },
    ]);

    await runAgentWorkflow(baseInput);

    expect(runAgentStep).toHaveBeenCalledTimes(3);
  });

  it("threads each iteration's responseMessages into the next iteration's modelMessages", async () => {
    queueSteps([
      {
        finishReason: "tool-calls",
        aborted: false,
        responseMessage: assistantMessage("a1"),
        responseMessages: [{ role: "assistant", content: "call-1" }],
      },
      {
        finishReason: "stop",
        aborted: false,
        responseMessage: assistantMessage("a2"),
        responseMessages: [{ role: "assistant", content: "done" }],
      },
    ]);

    await runAgentWorkflow(baseInput);

    const secondCall = vi.mocked(runAgentStep).mock.calls[1][0] as {
      modelMessages: Array<{ role: string; content: string }>;
    };
    expect(secondCall.modelMessages).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "call-1" },
    ]);
  });

  it("emits exactly one stream start and one stream finish across a multi-iteration turn", async () => {
    queueSteps([
      {
        finishReason: "tool-calls",
        aborted: false,
        responseMessage: assistantMessage("a1"),
        responseMessages: [{ role: "assistant", content: "call-1" }],
      },
      {
        finishReason: "tool-calls",
        aborted: false,
        responseMessage: assistantMessage("a2"),
        responseMessages: [{ role: "assistant", content: "call-2" }],
      },
      {
        finishReason: "stop",
        aborted: false,
        responseMessage: assistantMessage("a3"),
        responseMessages: [],
      },
    ]);

    await runAgentWorkflow(baseInput);

    expect(sendStreamStart).toHaveBeenCalledTimes(1);
    expect(sendStreamStart).toHaveBeenCalledWith(writableStub, "asst-loop-id");
    expect(sendStreamFinish).toHaveBeenCalledTimes(1);
  });

  it("stops looping when a step reports the user aborted, even on tool-calls", async () => {
    queueSteps([
      {
        finishReason: "tool-calls",
        aborted: true,
        responseMessage: assistantMessage("a1"),
        responseMessages: [{ role: "assistant", content: "call-1" }],
      },
    ]);

    await runAgentWorkflow(baseInput);

    expect(runAgentStep).toHaveBeenCalledTimes(1);
  });

  // Persistence lives in the workflow body, mirroring upstream open-agents
  // (`persistAssistantMessage(options.chatId, pendingAssistantResponse)`).
  // Persisting per iteration keeps a long turn's transcript live rather than
  // landing only at the end.
  it("persists the accumulated assistant message after each iteration", async () => {
    queueSteps([
      {
        finishReason: "tool-calls",
        aborted: false,
        responseMessage: assistantMessage("a1"),
        responseMessages: [{ role: "assistant", content: "call-1" }],
      },
      {
        finishReason: "stop",
        aborted: false,
        responseMessage: assistantMessage("a2"),
        responseMessages: [],
      },
    ]);

    await runAgentWorkflow(baseInput);

    expect(persistAssistantMessageStep).toHaveBeenCalledTimes(2);
    expect(persistAssistantMessageStep).toHaveBeenNthCalledWith(
      1,
      "chat-1",
      assistantMessage("a1"),
    );
    expect(persistAssistantMessageStep).toHaveBeenNthCalledWith(
      2,
      "chat-1",
      assistantMessage("a2"),
    );
  });

  it("bounds a runaway tool-call loop at CHAT_AGENT_MAX_ITERATIONS", async () => {
    vi.mocked(runAgentStep).mockResolvedValue({
      finishReason: "tool-calls",
      aborted: false,
      responseMessage: assistantMessage("a"),
      responseMessages: [{ role: "assistant", content: "again" }],
    } as never);

    await runAgentWorkflow(baseInput);

    expect(runAgentStep).toHaveBeenCalledTimes(CHAT_AGENT_MAX_ITERATIONS);
  });
});
