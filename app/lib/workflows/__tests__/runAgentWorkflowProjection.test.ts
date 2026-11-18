import { prepareProjectionHistoryStep } from "../projection/prepareProjectionHistoryStep";
import { recordProjectionProofStep } from "../projection/recordProjectionProofStep";
import { persistProjectedAssistantStep } from "../projection/persistProjectedAssistantStep";
import { sendProjectionFailureStep } from "../projection/sendProjectionFailureStep";
import { it, expect, vi, beforeEach } from "vitest";
import { persistAssistantMessageStep } from "../persistAssistantMessageStep";
import { runAgentWorkflow } from "@/app/lib/workflows/runAgentWorkflow";
import { runAgentStep } from "@/app/lib/workflows/runAgentStep";
import { closeChatStream } from "@/app/lib/workflows/closeChatStream";
import { sendStreamFinish } from "@/app/lib/workflows/sendStreamFinish";
import { generateAssistantMessageId } from "@/app/lib/workflows/generateAssistantMessageId";
import { handleChatCredits } from "@/lib/credits/handleChatCredits";
import { autoCommitChatTurn } from "@/lib/chat/auto-commit/autoCommitChatTurn";

vi.mock("@/app/lib/workflows/prepareCatalogSurfaceStep", () => ({
  prepareCatalogSurfaceStep: vi.fn(),
}));
vi.mock("@/app/lib/workflows/sendCatalogSurfaceStep", () => ({ sendCatalogSurfaceStep: vi.fn() }));

vi.mock("@/app/lib/workflows/routeChatModelStep", () => ({ routeChatModelStep: vi.fn() }));
vi.mock("@/app/lib/workflows/deleteEphemeralKeyStep", () => ({
  deleteEphemeralKeyStep: vi.fn(),
}));
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
// The loop's supporting steps — exercised in runAgentWorkflowLoop.test.ts.
vi.mock("@/app/lib/workflows/convertMessagesStep", () => ({
  convertMessagesStep: vi.fn(() => Promise.resolve([])),
}));
vi.mock("@/app/lib/workflows/persistAssistantMessageStep", () => ({
  persistAssistantMessageStep: vi.fn(),
}));
vi.mock("@/app/lib/workflows/sendStreamStart", () => ({ sendStreamStart: vi.fn() }));
vi.mock("@/app/lib/workflows/sendStreamFinish", () => ({ sendStreamFinish: vi.fn() }));
vi.mock("@/lib/credits/handleChatCredits", () => ({
  handleChatCredits: vi.fn(),
}));
vi.mock("@/lib/chat/auto-commit/autoCommitChatTurn", () => ({
  autoCommitChatTurn: vi.fn(),
}));
// Captured writable stub so tests can assert closeChatStream got the
// same instance the workflow body holds.
const writableStub = new WritableStream();
vi.mock("workflow", async importOriginal => ({
  ...(await importOriginal<typeof import("workflow")>()),
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
  streamProtocol: "canonical-base-v1" as const,
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

vi.mock("../projection/prepareProjectionHistoryStep", () => ({
  prepareProjectionHistoryStep: vi.fn(async messages => ({
    canonical: messages,
    native: messages,
  })),
}));
vi.mock("../projection/recordProjectionProofStep", () => ({ recordProjectionProofStep: vi.fn() }));
vi.mock("../projection/persistProjectedAssistantStep", () => ({
  persistProjectedAssistantStep: vi.fn(),
}));
vi.mock("../projection/sendProjectionFailureStep", () => ({ sendProjectionFailureStep: vi.fn() }));
const projected = {
  ...(responseMessageWithMetadata as object),
  id: "assistant",
  role: "assistant",
  parts: [
    {
      type: "data-recoup-sdk-observation",
      id: "assistant:projection:0",
      data: { originStepId: "step" },
    },
  ],
} as never;
const proof = {
  contract: "recoup-sdk-projection/v1",
  observations: [{ observation: { data: { originStepId: "step" } } }],
} as never;
beforeEach(() => {
  vi.mocked(prepareProjectionHistoryStep)
    .mockReset()
    .mockImplementation(async messages => ({ canonical: messages, native: messages }));
  vi.mocked(recordProjectionProofStep).mockReset();
  vi.mocked(persistProjectedAssistantStep).mockReset();
  vi.mocked(runAgentStep).mockReset().mockResolvedValue({
    finishReason: "stop",
    aborted: false,
    responseMessages: [],
    responseMessage: projected,
    generatedProjectionObservations: proof,
  });
});
it("requires producer then receipt then raw verification then message ACK before one charge", async () => {
  await runAgentWorkflow(baseInput);
  expect(recordProjectionProofStep).toHaveBeenCalledTimes(1);
  expect(prepareProjectionHistoryStep).toHaveBeenCalledTimes(2);
  expect(persistProjectedAssistantStep).toHaveBeenCalledTimes(1);
  expect(persistAssistantMessageStep).not.toHaveBeenCalled();
  expect(handleChatCredits).toHaveBeenCalledTimes(1);
  expect(vi.mocked(recordProjectionProofStep).mock.invocationCallOrder[0]).toBeGreaterThan(
    vi.mocked(runAgentStep).mock.invocationCallOrder[0],
  );
  expect(vi.mocked(prepareProjectionHistoryStep).mock.invocationCallOrder[1]).toBeGreaterThan(
    vi.mocked(recordProjectionProofStep).mock.invocationCallOrder[0],
  );
  expect(vi.mocked(handleChatCredits).mock.invocationCallOrder[0]).toBeGreaterThan(
    vi.mocked(persistProjectedAssistantStep).mock.invocationCallOrder[0],
  );
});
it.each(["generation", "receipt", "readback", "persistence"])(
  "%s failure never charges, auto-commits, retries provider or emits successful finish",
  async kind => {
    if (kind === "generation")
      vi.mocked(runAgentStep).mockResolvedValue({
        finishReason: "error",
        aborted: false,
        responseMessage: undefined,
        responseMessages: [],
        compatibilityFailure: {
          code: "evidence_unavailable",
          usageComplete: false,
          observedMetadata: { totalMessageCost: 0.01 },
        },
      });
    if (kind === "receipt")
      vi.mocked(recordProjectionProofStep).mockRejectedValue(new Error("receipt failed"));
    if (kind === "readback")
      vi.mocked(prepareProjectionHistoryStep)
        .mockResolvedValueOnce({ canonical: baseInput.messages, native: baseInput.messages })
        .mockRejectedValueOnce(new Error("readback failed"));
    if (kind === "persistence")
      vi.mocked(persistProjectedAssistantStep).mockRejectedValue(new Error("unknown ACK"));
    await expect(runAgentWorkflow(baseInput)).rejects.toThrow();
    expect(runAgentStep).toHaveBeenCalledTimes(1);
    expect(handleChatCredits).not.toHaveBeenCalled();
    expect(autoCommitChatTurn).not.toHaveBeenCalled();
    expect(sendStreamFinish).not.toHaveBeenCalled();
    expect(sendProjectionFailureStep).toHaveBeenCalledTimes(1);
    expect(closeChatStream).toHaveBeenCalledTimes(1);
  },
);

it("charges acknowledged projected Stop once after required gates and skips auto-commit", async () => {
  vi.mocked(runAgentStep).mockResolvedValue({
    finishReason: "stop",
    aborted: true,
    responseMessages: [],
    responseMessage: projected,
    generatedProjectionObservations: proof,
  });
  await runAgentWorkflow(baseInput);
  expect(recordProjectionProofStep).toHaveBeenCalledTimes(1);
  expect(prepareProjectionHistoryStep).toHaveBeenCalledTimes(2);
  expect(persistProjectedAssistantStep).toHaveBeenCalledTimes(1);
  expect(handleChatCredits).toHaveBeenCalledTimes(1);
  expect(vi.mocked(handleChatCredits).mock.invocationCallOrder[0]).toBeGreaterThan(
    vi.mocked(persistProjectedAssistantStep).mock.invocationCallOrder[0],
  );
  expect(autoCommitChatTurn).not.toHaveBeenCalled();
  expect(sendProjectionFailureStep).not.toHaveBeenCalled();
});
it.each(["first", "later"])(
  "signals %s producer rejection as failure, preserving original error",
  async iteration => {
    const failure = new Error("producer result rejected");
    if (iteration === "later")
      vi.mocked(runAgentStep).mockResolvedValueOnce({
        finishReason: "tool-calls",
        aborted: false,
        responseMessages: [],
        responseMessage: projected,
        generatedProjectionObservations: proof,
      });
    vi.mocked(runAgentStep).mockRejectedValue(failure);
    await expect(runAgentWorkflow(baseInput)).rejects.toBe(failure);
    expect(sendProjectionFailureStep).toHaveBeenCalledTimes(1);
    expect(sendStreamFinish).not.toHaveBeenCalled();
    expect(handleChatCredits).not.toHaveBeenCalled();
    expect(autoCommitChatTurn).not.toHaveBeenCalled();
  },
);

it("preserves producer rejection when failure-stream signalling also fails", async () => {
  const failure = new Error("producer result missing");
  vi.mocked(runAgentStep).mockRejectedValue(failure);
  vi.mocked(sendProjectionFailureStep).mockRejectedValueOnce(new Error("unknown error-finish ACK"));
  await expect(runAgentWorkflow(baseInput)).rejects.toBe(failure);
  expect(closeChatStream).toHaveBeenCalledTimes(1);
  expect(handleChatCredits).not.toHaveBeenCalled();
});
