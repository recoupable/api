import { beforeEach, expect, it, vi } from "vitest";
import { streamText, type UIMessage, type LanguageModelUsage } from "ai";
import { runAgentStep } from "../runAgentStep";
const state = vi.hoisted(() => ({ cancelled: true, abortSignal: false }));
vi.mock("ai", async original => ({
  ...(await original<typeof import("ai")>()),
  streamText: vi.fn(),
}));
vi.mock("@ai-sdk/gateway", () => ({ gateway: () => ({}) }));
vi.mock("@/lib/agent/buildAgentTools", () => ({ buildAgentTools: () => ({}) }));
vi.mock("workflow", async original => ({
  ...(await original<typeof import("workflow")>()),
  getWorkflowMetadata: () => ({ workflowRunId: "run" }),
  getStepMetadata: () => ({ stepId: "step", attempt: 1 }),
}));
vi.mock("@/lib/chat/pollWorkflowCancellation", () => ({
  pollWorkflowCancellation: (_id: string, controller: AbortController) => {
    if (state.abortSignal) controller.abort();
    return { stop() {}, done: Promise.resolve() };
  },
}));
vi.mock("@/lib/chat/isRunCancelled", () => ({ isRunCancelled: async () => state.cancelled }));
const usage: LanguageModelUsage = {
  inputTokens: 100,
  outputTokens: 20,
  totalTokens: 120,
  inputTokenDetails: { noCacheTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 },
  outputTokenDetails: { textTokens: 20, reasoningTokens: 0 },
};
const original = { type: "custom", kind: "provider.prior" };
const fallback = "This view cannot display additional model content.";
const seed = {
  id: "assistant",
  role: "assistant",
  parts: [
    {
      type: "data-recoup-sdk-observation",
      id: "assistant:projection:0",
      data: {
        version: 1,
        originRunId: "prior",
        originStepId: "prior-step",
        assistantMessageId: "assistant",
        ordinal: 0,
        original,
        fallback: { partIndex: 1, text: fallback },
      },
    },
    { type: "text", text: fallback, state: "done" },
  ],
  metadata: { totalMessageCost: 0.07, totalMessageUsage: usage },
} as UIMessage;
beforeEach(() => {
  vi.clearAllMocks();
  state.cancelled = true;
  state.abortSignal = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Network forbidden");
    }),
  );
});
async function execute(
  mode: "stop" | "emitted-stop" | "failure" | "fresh-usage-failure" | "write-failure",
  previous = seed,
) {
  vi.mocked(streamText).mockReturnValue({
    toUIMessageStream: (options: { messageMetadata: (event: unknown) => unknown }) =>
      (async function* () {
        if (mode === "emitted-stop") yield { type: "custom", kind: "provider.fresh" };
        if (mode === "fresh-usage-failure") {
          const metadata = options.messageMetadata({
            part: {
              type: "finish-step",
              usage: {
                inputTokens: 5,
                outputTokens: 2,
                totalTokens: 7,
                inputTokenDetails: { noCacheTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 },
                outputTokenDetails: { textTokens: 2, reasoningTokens: 0 },
              },
              providerMetadata: { gateway: { cost: "0.01" } },
              finishReason: "stop",
            },
          });
          yield { type: "message-metadata", messageMetadata: metadata };
        }
        if (mode === "failure" || mode === "fresh-usage-failure")
          yield { type: "data-recoup-sdk-observation", id: "forged", data: {} };
        else if (mode === "write-failure") yield { type: "text-start", id: "text" };
        else throw new DOMException("Confirmed user Stop", "AbortError");
      })(),
    finishReason: Promise.resolve("stop"),
    responseMessages: Promise.resolve([]),
  } as never);
  const chunks: unknown[] = [];
  const result = await runAgentStep({
    modelMessages: [],
    originalMessages: [previous],
    nativeOriginalMessages: [{ ...previous, parts: [original as never] }],
    modelId: "synthetic",
    assistantMessageId: "assistant",
    agentContext: {
      sandbox: { state: { type: "vercel" }, workingDirectory: "/synthetic" },
    } as never,
    writable: new WritableStream({
      write(chunk) {
        if (mode === "write-failure") throw new DOMException("Unknown append", "AbortError");
        chunks.push(chunk);
      },
    }),
  });
  expect(streamText).toHaveBeenCalledTimes(1);
  expect(fetch).not.toHaveBeenCalled();
  return { result, chunks };
}
it("preserves genuine Stop after projected seed with canonical partial history", async () => {
  const { result } = await execute("stop");
  expect(result.aborted).toBe(true);
  expect(result.finishReason).toBe("stop");
  expect(result.compatibilityFailure).toBeUndefined();
  expect(result.responseMessage).toEqual(seed);
});
it("retains fresh canonical proof on genuine Stop after an emitted observation", async () => {
  const { result, chunks } = await execute("emitted-stop");
  expect(result.aborted).toBe(true);
  expect(result.compatibilityFailure).toBeUndefined();
  expect(result.generatedProjectionObservations?.observations).toHaveLength(1);
  expect(
    result.responseMessage?.parts.filter(part => part.type === "data-recoup-sdk-observation"),
  ).toHaveLength(2);
  expect(chunks.some(chunk => (chunk as { type: string }).type === "custom")).toBe(false);
});
it("preserves known seed expense when compatibility failure precedes fresh usage", async () => {
  state.cancelled = false;
  const { result } = await execute("failure");
  expect(result.compatibilityFailure).toMatchObject({
    observedMetadata: { totalMessageCost: 0.07, totalMessageUsage: usage },
    usageComplete: false,
  });
  expect(result.aborted).toBe(false);
});
it("replaces the seed subtotal with one cumulative fresh metadata observation", async () => {
  state.cancelled = false;
  const { result } = await execute("fresh-usage-failure");
  expect(result.compatibilityFailure?.observedMetadata?.totalMessageCost).toBeCloseTo(0.08);
  expect(result.compatibilityFailure?.observedMetadata?.totalMessageUsage).toMatchObject({
    inputTokens: 105,
    outputTokens: 22,
    totalTokens: 127,
  });
  expect(result.compatibilityFailure?.usageComplete).toBe(false);
});
it.each(["failure", "write-failure"] as const)(
  "does not relabel %s as Stop even with an aborted signal and confirmed cancellation",
  async mode => {
    state.abortSignal = true;
    const { result } = await execute(mode);
    expect(result.aborted).toBe(false);
    expect(result.finishReason).toBe("error");
    expect(result.compatibilityFailure).toBeDefined();
  },
);
