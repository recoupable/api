import { convertMessagesStep } from "../convertMessagesStep";
import { createFencedMessageWriter } from "@/lib/chat/fence/persistence/createFencedMessageWriter";
import { executeChatFenceCommand } from "@/lib/supabase/chat_fence/executeChatFenceCommand";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { routeChatModelStep } from "../routeChatModelStep";
import { persistAssistantMessageStep } from "../persistAssistantMessageStep";
import { runAgentWorkflow } from "@/app/lib/workflows/runAgentWorkflow";
import { runAgentStep } from "@/app/lib/workflows/runAgentStep";
import { clearChatActiveStream } from "@/lib/chat/clearChatActiveStream";
import { generateAssistantMessageId } from "@/app/lib/workflows/generateAssistantMessageId";
import { handleChatCredits } from "@/lib/credits/handleChatCredits";
import { autoCommitChatTurn } from "@/lib/chat/auto-commit/autoCommitChatTurn";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc } }));

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
  vi.resetAllMocks();
  vi.mocked(convertMessagesStep).mockResolvedValue([]);
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

// Test-only substitution at the existing step boundary. Production still uses its legacy helper.
describe("required adapter at actual workflow persistence call sites", () => {
  beforeEach(() => {
    const writer = createFencedMessageWriter(
      {
        chatId: baseInput.chatId,
        effectiveAccount: "11111111-1111-4111-8111-111111111111",
        epoch: 1,
        owner: "22222222-2222-4222-8222-222222222222",
        runId: "wrun_from_metadata",
      },
      executeChatFenceCommand,
    );
    vi.mocked(persistAssistantMessageStep).mockImplementation(async (_chat, message) => {
      await writer.upsertAssistant(message);
    });
    rpc.mockResolvedValue({ data: null, error: { code: "40001" } } as never);
  });
  it("pre-provider routing persistence failure propagates before the agent provider", async () => {
    vi.mocked(routeChatModelStep).mockResolvedValue({
      modelId: "synthetic-model",
      metadata: { selectedModelId: "auto" },
    } as never);
    await expect(runAgentWorkflow({ ...baseInput, modelId: "auto" })).rejects.toThrow(
      "Required fenced persistence failed",
    );
    expect(runAgentStep).not.toHaveBeenCalled();
    expect(handleChatCredits).not.toHaveBeenCalled();
    expect(autoCommitChatTurn).not.toHaveBeenCalled();
    // Explicit remaining production gap: legacy finally cleanup still executes.
    expect(clearChatActiveStream).toHaveBeenCalledExactlyOnceWith("chat-1", "wrun_from_metadata");
  });
  it("failed iteration persistence prevents the next provider iteration and post-loop effects", async () => {
    vi.mocked(runAgentStep).mockResolvedValue({
      finishReason: "tool-calls",
      aborted: false,
      responseMessages: [],
      responseMessage: responseMessageWithMetadata,
    });
    await expect(runAgentWorkflow(baseInput)).rejects.toThrow("Required fenced persistence failed");
    expect(runAgentStep).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(handleChatCredits).not.toHaveBeenCalled();
    expect(autoCommitChatTurn).not.toHaveBeenCalled();
    expect(clearChatActiveStream).toHaveBeenCalledTimes(1);
  });
  it("awaits the required acknowledgement before the next provider iteration", async () => {
    let acknowledge!: (value: never) => void;
    rpc.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          acknowledge = resolve;
        }) as never,
    );
    vi.mocked(runAgentStep)
      .mockResolvedValueOnce({
        finishReason: "tool-calls",
        aborted: false,
        responseMessages: [],
        responseMessage: responseMessageWithMetadata,
      })
      .mockResolvedValueOnce({
        finishReason: "stop",
        aborted: false,
        responseMessages: [],
        responseMessage: undefined,
      });
    const running = runAgentWorkflow(baseInput);
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(runAgentStep).toHaveBeenCalledTimes(1);
    expect(clearChatActiveStream).not.toHaveBeenCalled();
    acknowledge({ data: { written: true, outcome: "inserted" }, error: null } as never);
    await running;
    expect(runAgentStep).toHaveBeenCalledTimes(2);
  });
});
