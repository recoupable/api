import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAgentWorkflow } from "@/app/lib/workflows/runAgentWorkflow";
import { runAgentStep } from "@/app/lib/workflows/runAgentStep";
import { clearChatActiveStream } from "@/lib/chat/clearChatActiveStream";
import { closeChatStream } from "@/app/lib/workflows/closeChatStream";
import { persistAssistantMessage } from "@/lib/chat/persistAssistantMessage";

vi.mock("@/app/lib/workflows/runAgentStep", () => ({
  runAgentStep: vi.fn(),
}));
vi.mock("@/lib/chat/clearChatActiveStream", () => ({
  clearChatActiveStream: vi.fn(),
}));
vi.mock("@/app/lib/workflows/closeChatStream", () => ({
  closeChatStream: vi.fn(),
}));
vi.mock("@/lib/chat/persistAssistantMessage", () => ({
  persistAssistantMessage: vi.fn(),
}));
// Captured writable stub so tests can assert closeChatStream got the
// same instance the workflow body holds.
const writableStub = new WritableStream();
vi.mock("workflow", () => ({
  getWritable: vi.fn(() => writableStub),
  getWorkflowMetadata: vi.fn(() => ({
    workflowRunId: "wrun_from_metadata",
    workflowName: "runAgentWorkflow",
    workflowStartedAt: new Date(),
    url: "https://example.invalid/workflow",
  })),
}));

beforeEach(() => vi.clearAllMocks());

const baseInput = {
  messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] } as never],
  chatId: "chat-1",
  sessionId: "session-1",
  modelId: "anthropic/claude-haiku-4.5",
  agentContext: {
    sandbox: { state: { type: "vercel" }, workingDirectory: "/sandbox/mono" },
  } as never,
};

describe("runAgentWorkflow", () => {
  it("clears active_stream_id after a successful run, using the workflow's own runId", async () => {
    vi.mocked(runAgentStep).mockResolvedValue({
      finishReason: "stop",
      responseMessage: undefined,
    });

    await runAgentWorkflow(baseInput);

    expect(clearChatActiveStream).toHaveBeenCalledTimes(1);
    expect(clearChatActiveStream).toHaveBeenCalledWith("chat-1", "wrun_from_metadata");
  });

  it("clears active_stream_id even when runAgentStep throws (try/finally guarantee)", async () => {
    vi.mocked(runAgentStep).mockRejectedValue(new Error("model exploded"));

    await expect(runAgentWorkflow(baseInput)).rejects.toThrow("model exploded");

    expect(clearChatActiveStream).toHaveBeenCalledTimes(1);
    expect(clearChatActiveStream).toHaveBeenCalledWith("chat-1", "wrun_from_metadata");
  });

  it("explicitly closes the chat writable after a successful run so SSE ends promptly", async () => {
    vi.mocked(runAgentStep).mockResolvedValue({
      finishReason: "stop",
      responseMessage: undefined,
    });

    await runAgentWorkflow(baseInput);

    expect(closeChatStream).toHaveBeenCalledTimes(1);
    expect(closeChatStream).toHaveBeenCalledWith(writableStub);
  });

  it("closes the chat writable even when runAgentStep throws (try/finally guarantee)", async () => {
    vi.mocked(runAgentStep).mockRejectedValue(new Error("model exploded"));

    await expect(runAgentWorkflow(baseInput)).rejects.toThrow("model exploded");

    expect(closeChatStream).toHaveBeenCalledTimes(1);
    expect(closeChatStream).toHaveBeenCalledWith(writableStub);
  });

  it("persists the assistant message when runAgentStep returns one", async () => {
    const responseMessage = {
      id: "assistant-msg-xyz",
      role: "assistant",
      parts: [{ type: "text", text: "Hello!" }],
    };
    vi.mocked(runAgentStep).mockResolvedValue({
      finishReason: "stop",
      responseMessage: responseMessage as never,
    });

    await runAgentWorkflow(baseInput);

    expect(persistAssistantMessage).toHaveBeenCalledTimes(1);
    expect(persistAssistantMessage).toHaveBeenCalledWith("chat-1", responseMessage);
  });

  it("does NOT call persistAssistantMessage when runAgentStep returns no responseMessage", async () => {
    vi.mocked(runAgentStep).mockResolvedValue({
      finishReason: "stop",
      responseMessage: undefined,
    });

    await runAgentWorkflow(baseInput);

    expect(persistAssistantMessage).not.toHaveBeenCalled();
  });

  it("does NOT call persistAssistantMessage when runAgentStep throws (no message to persist)", async () => {
    vi.mocked(runAgentStep).mockRejectedValue(new Error("model exploded"));

    await expect(runAgentWorkflow(baseInput)).rejects.toThrow("model exploded");

    expect(persistAssistantMessage).not.toHaveBeenCalled();
    // But cleanup steps still run via the try/finally
    expect(clearChatActiveStream).toHaveBeenCalledTimes(1);
    expect(closeChatStream).toHaveBeenCalledTimes(1);
  });
});
