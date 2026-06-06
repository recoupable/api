import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAgentWorkflow } from "@/app/lib/workflows/runAgentWorkflow";
import { runAgentStep } from "@/app/lib/workflows/runAgentStep";
import { clearChatActiveStream } from "@/lib/chat/clearChatActiveStream";
import { closeChatStream } from "@/app/lib/workflows/closeChatStream";
import { generateAssistantMessageId } from "@/app/lib/workflows/generateAssistantMessageId";
import { handleChatCredits } from "@/lib/credits/handleChatCredits";
import { handleSubagentChatCredits } from "@/lib/credits/handleSubagentChatCredits";
import { autoCommitChatTurn } from "@/lib/chat/auto-commit/autoCommitChatTurn";

vi.mock("@/app/lib/workflows/runAgentStep", () => ({
  runAgentStep: vi.fn(),
}));
vi.mock("@/lib/chat/clearChatActiveStream", () => ({
  clearChatActiveStream: vi.fn(),
}));
vi.mock("@/app/lib/workflows/closeChatStream", () => ({
  closeChatStream: vi.fn(),
}));
vi.mock("@/app/lib/workflows/generateAssistantMessageId", () => ({
  generateAssistantMessageId: vi.fn(),
}));
vi.mock("@/lib/credits/handleChatCredits", () => ({
  handleChatCredits: vi.fn(),
}));
vi.mock("@/lib/credits/handleSubagentChatCredits", () => ({
  handleSubagentChatCredits: vi.fn(),
}));
vi.mock("@/lib/chat/auto-commit/autoCommitChatTurn", () => ({
  autoCommitChatTurn: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(generateAssistantMessageId).mockResolvedValue("asst-fresh-id");
});

const baseInput = {
  messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] } as never],
  chatId: "chat-1",
  sessionId: "session-1",
  accountId: "acc-1",
  modelId: "anthropic/claude-haiku-4.5",
  sessionTitle: "test session",
  repoOwner: "recoupable",
  repoName: "api",
  agentContext: {
    sandbox: { state: { type: "vercel" }, workingDirectory: "/sandbox/mono" },
  } as never,
};

const responseMessageWithMetadata = {
  id: "asst-msg-1",
  role: "assistant",
  parts: [{ type: "text", text: "Hello!" }],
  metadata: {
    totalMessageCost: 0.07,
    totalMessageUsage: { inputTokens: 100, cachedInputTokens: 10, outputTokens: 20 },
  },
} as never;

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

  it("forwards chatId to runAgentStep so it can persist the assistant message per step", async () => {
    vi.mocked(runAgentStep).mockResolvedValue({
      finishReason: "stop",
      responseMessage: undefined,
    });

    await runAgentWorkflow(baseInput);

    expect(runAgentStep).toHaveBeenCalledWith(expect.objectContaining({ chatId: "chat-1" }));
  });

  it("generates a fresh assistantMessageId via the step and forwards it to runAgentStep", async () => {
    vi.mocked(runAgentStep).mockResolvedValue({
      finishReason: "stop",
      responseMessage: undefined,
    });

    await runAgentWorkflow(baseInput);

    expect(generateAssistantMessageId).toHaveBeenCalledTimes(1);
    expect(runAgentStep).toHaveBeenCalledWith(
      expect.objectContaining({ assistantMessageId: "asst-fresh-id" }),
    );
  });

  it("reuses the latest assistant message id when resuming a tool-call turn (no fresh generation)", async () => {
    vi.mocked(runAgentStep).mockResolvedValue({
      finishReason: "stop",
      responseMessage: undefined,
    });

    const resumingInput = {
      ...baseInput,
      messages: [
        { id: "m1", role: "user", parts: [{ type: "text", text: "go" }] },
        {
          id: "asst-in-progress",
          role: "assistant",
          parts: [{ type: "text", text: "thinking..." }],
        },
      ] as never,
    };

    await runAgentWorkflow(resumingInput);

    expect(generateAssistantMessageId).not.toHaveBeenCalled();
    expect(runAgentStep).toHaveBeenCalledWith(
      expect.objectContaining({ assistantMessageId: "asst-in-progress" }),
    );
  });

  it("calls handleChatCredits with the gateway cost + token usage from responseMessage.metadata", async () => {
    const responseMessage = {
      id: "assistant-msg-xyz",
      role: "assistant",
      parts: [{ type: "text", text: "Hello!" }],
      metadata: {
        totalMessageCost: 0.07,
        totalMessageUsage: {
          inputTokens: 100,
          cachedInputTokens: 10,
          outputTokens: 20,
        },
      },
    };
    vi.mocked(runAgentStep).mockResolvedValue({
      finishReason: "stop",
      responseMessage: responseMessage as never,
    });

    await runAgentWorkflow(baseInput);

    expect(handleChatCredits).toHaveBeenCalledTimes(1);
    expect(handleChatCredits).toHaveBeenCalledWith({
      accountId: "acc-1",
      model: "anthropic/claude-haiku-4.5",
      source: "api",
      gatewayCostUsd: 0.07,
      usage: {
        inputTokens: 100,
        cachedInputTokens: 10,
        outputTokens: 20,
      },
    });
    expect(handleSubagentChatCredits).toHaveBeenCalledWith({
      accountId: "acc-1",
      responseMessage,
      previousResponseMessage: undefined,
      fallbackModelId: "anthropic/claude-haiku-4.5",
      source: "api",
    });
  });

  it("passes the in-progress assistant message as subagent baseline when resuming a turn", async () => {
    const resumedAssistant = {
      id: "asst-resume",
      role: "assistant",
      parts: [{ type: "text", text: "working..." }],
    };
    vi.mocked(runAgentStep).mockResolvedValue({
      finishReason: "stop",
      responseMessage: responseMessageWithMetadata,
    });

    await runAgentWorkflow({
      ...baseInput,
      messages: [resumedAssistant as never],
    });

    expect(handleSubagentChatCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        previousResponseMessage: resumedAssistant,
      }),
    );
  });

  it("calls handleChatCredits with zero usage when metadata is missing (lets the 1c floor apply)", async () => {
    const responseMessage = {
      id: "assistant-msg-xyz",
      role: "assistant",
      parts: [{ type: "text", text: "Hello!" }],
      // no metadata
    };
    vi.mocked(runAgentStep).mockResolvedValue({
      finishReason: "stop",
      responseMessage: responseMessage as never,
    });

    await runAgentWorkflow(baseInput);

    expect(handleChatCredits).toHaveBeenCalledTimes(1);
    expect(handleChatCredits).toHaveBeenCalledWith({
      accountId: "acc-1",
      model: "anthropic/claude-haiku-4.5",
      source: "api",
      gatewayCostUsd: undefined,
      usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 },
    });
  });

  it("does NOT call handleChatCredits when runAgentStep returns no responseMessage", async () => {
    vi.mocked(runAgentStep).mockResolvedValue({
      finishReason: "stop",
      responseMessage: undefined,
    });

    await runAgentWorkflow(baseInput);

    expect(handleChatCredits).not.toHaveBeenCalled();
    expect(handleSubagentChatCredits).not.toHaveBeenCalled();
  });

  it("does NOT call handleChatCredits when runAgentStep throws (no message to bill)", async () => {
    vi.mocked(runAgentStep).mockRejectedValue(new Error("model exploded"));

    await expect(runAgentWorkflow(baseInput)).rejects.toThrow("model exploded");

    expect(handleChatCredits).not.toHaveBeenCalled();
    expect(handleSubagentChatCredits).not.toHaveBeenCalled();
  });

  describe("auto-commit", () => {
    // The auto-commit flow itself is exhaustively covered in
    // `lib/chat/auto-commit/__tests__/autoCommitChatTurn.test.ts`.
    // These tests only verify the workflow body wires the orchestrator
    // up with the right inputs.

    it("calls autoCommitChatTurn with workflow context after persistAssistantMessage", async () => {
      vi.mocked(runAgentStep).mockResolvedValue({
        finishReason: "stop",
        responseMessage: responseMessageWithMetadata,
      });

      await runAgentWorkflow(baseInput);

      expect(autoCommitChatTurn).toHaveBeenCalledTimes(1);
      // Workflow spreads `...input, ...result` into the call so any
      // future fields are forwarded automatically. Only assert on the
      // fields autoCommitChatTurn actually consumes — extra fields
      // from input/result are fine to pass through.
      expect(autoCommitChatTurn).toHaveBeenCalledWith(
        expect.objectContaining({
          writable: writableStub,
          responseMessage: responseMessageWithMetadata,
          finishReason: "stop",
          sessionId: "session-1",
          sessionTitle: "test session",
          repoOwner: "recoupable",
          repoName: "api",
          sandboxState: { type: "vercel", ...baseInput.agentContext.sandbox.state },
        }),
      );
    });

    it("wraps the raw VercelState with `type: 'vercel'` before forwarding", async () => {
      vi.mocked(runAgentStep).mockResolvedValue({
        finishReason: "stop",
        responseMessage: responseMessageWithMetadata,
      });

      await runAgentWorkflow(baseInput);

      const call = vi.mocked(autoCommitChatTurn).mock.calls[0]?.[0];
      expect(call?.sandboxState).toMatchObject({ type: "vercel" });
    });

    it("forwards undefined sandboxState when agentContext.sandbox is missing", async () => {
      vi.mocked(runAgentStep).mockResolvedValue({
        finishReason: "stop",
        responseMessage: responseMessageWithMetadata,
      });

      await runAgentWorkflow({
        ...baseInput,
        agentContext: {} as never,
      });

      const call = vi.mocked(autoCommitChatTurn).mock.calls[0]?.[0];
      expect(call?.sandboxState).toBeUndefined();
    });

    it("does NOT call autoCommitChatTurn when runAgentStep returns no responseMessage", async () => {
      vi.mocked(runAgentStep).mockResolvedValue({
        finishReason: "stop",
        responseMessage: undefined,
      });

      await runAgentWorkflow(baseInput);

      expect(autoCommitChatTurn).not.toHaveBeenCalled();
    });
  });
});
