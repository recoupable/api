import { clearChatActiveStream } from "@/lib/chat/clearChatActiveStream";
import { sendStreamFinish } from "@/app/lib/workflows/sendStreamFinish";
import { closeChatStream } from "@/app/lib/workflows/closeChatStream";
import { deleteEphemeralKeyStep } from "@/app/lib/workflows/deleteEphemeralKeyStep";
import { bindFencedWorkflowStep } from "@/app/lib/workflows/fence/bindFencedWorkflowStep";
import { releaseFencedWorkflowStep } from "@/app/lib/workflows/fence/releaseFencedWorkflowStep";
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { runAgentWorkflow } from "@/app/lib/workflows/runAgentWorkflow";
import { runAgentStep } from "@/app/lib/workflows/runAgentStep";
import { convertMessagesStep } from "@/app/lib/workflows/convertMessagesStep";
import { generateAssistantMessageId } from "@/app/lib/workflows/generateAssistantMessageId";
import { persistAssistantMessageStep } from "@/app/lib/workflows/persistAssistantMessageStep";
import { autoCommitChatTurn } from "@/lib/chat/auto-commit/autoCommitChatTurn";
import { routeChatModelStep } from "@/app/lib/workflows/routeChatModelStep";
vi.mock("@/app/lib/workflows/fence/bindFencedWorkflowStep", () => ({
  bindFencedWorkflowStep: vi.fn(),
}));
vi.mock("@/app/lib/workflows/fence/persistFencedMessageStep", () => ({
  persistFencedMessageStep: vi.fn(),
}));
vi.mock("@/app/lib/workflows/fence/releaseFencedWorkflowStep", () => ({
  releaseFencedWorkflowStep: vi.fn(),
}));
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

it.each([
  ["raw", false],
  ["raw", true],
  ["converted", false],
  ["converted", true],
] as const)("cleans legacy %s denial exactly once (headless=%s)", async (stage, headless) => {
  const cleanupOrder: string[] = [];
  vi.mocked(sendStreamFinish).mockImplementation(async () => {
    cleanupOrder.push("finish");
  });
  vi.mocked(closeChatStream).mockImplementation(async () => {
    cleanupOrder.push("close");
  });
  if (stage === "converted")
    vi.mocked(convertMessagesStep).mockResolvedValue([{ mode: "retained_field" }] as never);
  await expect(
    runAgentWorkflow({
      ...baseInput,
      messages: stage === "raw" ? [marked] : baseInput.messages,
      agentContext: {
        sandbox: { state: { type: "vercel" }, workingDirectory: "/sandbox/mono" },
        ...(headless ? { ephemeralKeyId: "owned-key" } : {}),
      } as never,
    }),
  ).rejects.toThrow("Retained-field model input unavailable");
  expect(clearChatActiveStream).toHaveBeenCalledExactlyOnceWith("chat-1", "wrun_loop_test");
  expect(sendStreamFinish).toHaveBeenCalledExactlyOnceWith(writableStub);
  expect(closeChatStream).toHaveBeenCalledExactlyOnceWith(writableStub);
  expect(cleanupOrder).toEqual(["finish", "close"]);
  if (headless) expect(deleteEphemeralKeyStep).toHaveBeenCalledExactlyOnceWith("owned-key");
  else expect(deleteEphemeralKeyStep).not.toHaveBeenCalled();
  expect(runAgentStep).not.toHaveBeenCalled();
  expect(routeChatModelStep).not.toHaveBeenCalled();
  expect(convertMessagesStep).toHaveBeenCalledTimes(stage === "raw" ? 0 : 1);
});
it.each(["raw", "converted"])("preserves fenced ownership on %s denial", async stage => {
  vi.mocked(bindFencedWorkflowStep).mockResolvedValue({
    writer: { synthetic: true },
    turn: { kind: "new" },
  } as never);
  if (stage === "converted")
    vi.mocked(convertMessagesStep).mockResolvedValue([{ mode: "retained_field" }] as never);
  await expect(
    runAgentWorkflow({
      kind: "internal-fenced/v1",
      fence: {},
      input: {
        ...baseInput,
        messages: stage === "raw" ? [marked] : baseInput.messages,
        agentContext: { ephemeralKeyId: "fenced-key" },
      },
    } as never),
  ).rejects.toThrow("Retained-field model input unavailable");
  expect(closeChatStream).toHaveBeenCalledExactlyOnceWith(writableStub);
  expect(clearChatActiveStream).not.toHaveBeenCalled();
  expect(sendStreamFinish).not.toHaveBeenCalled();
  expect(deleteEphemeralKeyStep).not.toHaveBeenCalled();
  expect(releaseFencedWorkflowStep).not.toHaveBeenCalled();
  expect(runAgentStep).not.toHaveBeenCalled();
});
it("does not acquire cleanup authority when fenced binding loses", async () => {
  vi.mocked(bindFencedWorkflowStep).mockRejectedValue(
    new Error("Fenced bind requires reconciliation"),
  );
  await expect(
    runAgentWorkflow({
      kind: "internal-fenced/v1",
      fence: {},
      input: { ...baseInput, messages: [marked] },
    } as never),
  ).rejects.toThrow("Fenced bind requires reconciliation");
  expect(closeChatStream).not.toHaveBeenCalled();
  expect(clearChatActiveStream).not.toHaveBeenCalled();
  expect(sendStreamFinish).not.toHaveBeenCalled();
  expect(deleteEphemeralKeyStep).not.toHaveBeenCalled();
  expect(releaseFencedWorkflowStep).not.toHaveBeenCalled();
});
