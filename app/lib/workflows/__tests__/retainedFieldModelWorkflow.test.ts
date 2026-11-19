import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { runAgentWorkflow } from "@/app/lib/workflows/runAgentWorkflow";
import { runAgentStep } from "@/app/lib/workflows/runAgentStep";
import { convertMessagesStep } from "@/app/lib/workflows/convertMessagesStep";
import { generateAssistantMessageId } from "@/app/lib/workflows/generateAssistantMessageId";
import { persistAssistantMessageStep } from "@/app/lib/workflows/persistAssistantMessageStep";
import { autoCommitChatTurn } from "@/lib/chat/auto-commit/autoCommitChatTurn";
import { routeChatModelStep } from "@/app/lib/workflows/routeChatModelStep";
vi.mock("@/app/lib/workflows/routeChatModelStep", () => ({ routeChatModelStep: vi.fn() }));

vi.mock("@/app/lib/workflows/prepareCatalogSurfaceStep", () => ({
  prepareCatalogSurfaceStep: vi.fn(),
}));
vi.mock("@/app/lib/workflows/sendCatalogSurfaceStep", () => ({ sendCatalogSurfaceStep: vi.fn() }));

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
  FatalError: class FatalError extends Error {},
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

const marker = {
  type: "data-retained-field-snapshot",
  capability: "retained-field-companion/1",
  data: { amount: 987654321 },
};
const marked = {
  id: "private",
  role: "assistant",
  parts: [
    marker,
    { type: "text", text: "PRIVATE 987654321" },
    { type: "file", url: "https://download.invalid/private", mediaType: "text/plain" },
  ],
} as never;
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("NETWORK FORBIDDEN");
    }),
  );
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
it("refuses marked original input before a journaled converter or model call", async () => {
  await expect(
    runAgentWorkflow({ ...baseInput, messages: [...baseInput.messages, marked] }),
  ).rejects.toThrow("Retained-field model input unavailable");
  expect(convertMessagesStep).not.toHaveBeenCalled();
  expect(runAgentStep).not.toHaveBeenCalled();
});
it("rechecks original inputs on replay even if a previously journaled conversion would erase the marker", async () => {
  vi.mocked(convertMessagesStep).mockResolvedValue([
    { role: "assistant", content: "PRIVATE 987654321" },
  ] as never);
  await expect(runAgentWorkflow({ ...baseInput, messages: [marked] })).rejects.toThrow(
    "Retained-field model input unavailable",
  );
  expect(convertMessagesStep).not.toHaveBeenCalled();
  expect(runAgentStep).not.toHaveBeenCalled();
});
it("refuses a marked journaled model conversion before calling the provider step", async () => {
  vi.mocked(convertMessagesStep).mockResolvedValue([
    {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: "call",
          toolName: "source",
          output: { type: "json", value: marker },
        },
      ],
    },
  ] as never);
  await expect(runAgentWorkflow(baseInput)).rejects.toThrow(
    "Retained-field model input unavailable",
  );
  expect(runAgentStep).not.toHaveBeenCalled();
});
it.each(["responseMessage", "responseMessages"])(
  "refuses marked %s from an earlier/journaled iteration before another provider call",
  async field => {
    queueSteps([
      {
        finishReason: "tool-calls",
        aborted: false,
        responseMessage: assistantMessage("a1"),
        responseMessages: [],
        [field]:
          field === "responseMessage"
            ? marked
            : [
                {
                  role: "tool",
                  content: [{ type: "tool-result", output: { type: "json", value: marker } }],
                },
              ],
      },
    ]);
    await expect(runAgentWorkflow(baseInput)).rejects.toThrow(
      "Retained-field model input unavailable",
    );
    expect(runAgentStep).toHaveBeenCalledTimes(1);
    expect(persistAssistantMessageStep).not.toHaveBeenCalled();
  },
);
it("keeps complete unmarked tool-call/result pairs and server account scope unchanged", async () => {
  const pair = [
    {
      role: "assistant",
      content: [{ type: "tool-call", toolCallId: "call", toolName: "safe", input: {} }],
    },
    {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: "call",
          toolName: "safe",
          output: { type: "json", value: { total: 0 } },
        },
      ],
    },
  ];
  queueSteps([
    { finishReason: "tool-calls", aborted: false, responseMessages: pair },
    { finishReason: "stop", aborted: false, responseMessages: [] },
  ]);
  await runAgentWorkflow(baseInput);
  expect(vi.mocked(runAgentStep).mock.calls[1][0].modelMessages).toEqual([
    { role: "user", content: "hi" },
    ...pair,
  ]);
  expect(vi.mocked(runAgentStep).mock.calls[1][0].accountId).toBe(baseInput.accountId);
});

it("auto routing cannot receive sibling text from a marked message", async () => {
  await expect(
    runAgentWorkflow({ ...baseInput, modelId: "auto", messages: [marked] }),
  ).rejects.toThrow("Retained-field model input unavailable");
  expect(routeChatModelStep).not.toHaveBeenCalled();
  expect(runAgentStep).not.toHaveBeenCalled();
});
it("a terminal marked result cannot reach auto-commit's subsequent model work", async () => {
  queueSteps([
    { finishReason: "stop", aborted: false, responseMessage: marked, responseMessages: [] },
  ]);
  await expect(runAgentWorkflow(baseInput)).rejects.toThrow(
    "Retained-field model input unavailable",
  );
  expect(autoCommitChatTurn).not.toHaveBeenCalled();
  expect(runAgentStep).toHaveBeenCalledTimes(1);
});
