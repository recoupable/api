import { beforeEach, expect, it, vi } from "vitest";
import { streamText } from "ai";
import { buildAgentTools } from "@/lib/agent/buildAgentTools";
import { upsertChatMessage } from "@/lib/supabase/chat_messages/upsertChatMessage";
import { runAgentStep } from "../runAgentStep";
import { persistProjectedAssistantStep } from "../projection/persistProjectedAssistantStep";
import { sendProjectionFailureStep } from "../projection/sendProjectionFailureStep";
const state = vi.hoisted(() => ({ attempt: 1 as number | undefined }));
vi.mock("workflow", async original => ({
  ...(await original<typeof import("workflow")>()),
  getStepMetadata: () => ({ attempt: state.attempt, stepId: "step" }),
  getWorkflowMetadata: () => ({ workflowRunId: "run" }),
}));
vi.mock("ai", async original => ({
  ...(await original<typeof import("ai")>()),
  streamText: vi.fn(() => ({
    toUIMessageStream: () =>
      (async function* () {
        yield { type: "text-start", id: "t" };
        yield { type: "text-end", id: "t" };
      })(),
    finishReason: Promise.resolve("stop"),
    responseMessages: Promise.resolve([]),
  })),
}));
vi.mock("@ai-sdk/gateway", () => ({ gateway: () => ({}) }));
vi.mock("@/lib/agent/buildAgentTools", () => ({ buildAgentTools: vi.fn(() => ({})) }));
vi.mock("@/lib/chat/pollWorkflowCancellation", () => ({
  pollWorkflowCancellation: () => ({ stop() {}, done: Promise.resolve() }),
}));
vi.mock("@/lib/chat/isRunCancelled", () => ({ isRunCancelled: async () => false }));
vi.mock("@/lib/supabase/chat_messages/upsertChatMessage", () => ({ upsertChatMessage: vi.fn() }));
vi.mock("@/lib/supabase/chats/updateChat", () => ({ updateChat: vi.fn() }));
const input = {
  modelMessages: [],
  originalMessages: [],
  modelId: "synthetic",
  assistantMessageId: "a",
  agentContext: { sandbox: { state: { type: "vercel" }, workingDirectory: "/synthetic" } },
} as never;
const message = { id: "a", role: "assistant", parts: [] } as never;
beforeEach(() => {
  state.attempt = 1;
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Network forbidden");
    }),
  );
});
it("does not reenter provider or append effects after unknown producer completion", async () => {
  const writes = vi.fn();
  const writable = new WritableStream({ write: writes });
  await runAgentStep({ ...(input as object), writable } as never);
  state.attempt = 2;
  await expect(runAgentStep({ ...(input as object), writable } as never)).rejects.toMatchObject({
    name: "FatalError",
  });
  expect(streamText).toHaveBeenCalledTimes(1);
  expect(writes).toHaveBeenCalledTimes(2);
  expect(fetch).not.toHaveBeenCalled();
});
it("does not repeat a required row write after unknown completion", async () => {
  vi.mocked(upsertChatMessage).mockResolvedValue({
    ok: true,
    isDuplicate: false,
    row: { id: "a", chat_id: "chat", role: "assistant", parts: message },
  } as never);
  await persistProjectedAssistantStep("chat", message);
  state.attempt = 2;
  await expect(persistProjectedAssistantStep("chat", message)).rejects.toMatchObject({
    name: "FatalError",
  });
  expect(upsertChatMessage).toHaveBeenCalledTimes(1);
});
it("does not append a failure stream again after unknown completion", async () => {
  const writes = vi.fn();
  const writable = new WritableStream({ write: writes });
  await sendProjectionFailureStep(writable);
  state.attempt = 2;
  await expect(sendProjectionFailureStep(writable)).rejects.toMatchObject({ name: "FatalError" });
  expect(writes).toHaveBeenCalledTimes(2);
});
it("also refuses redelivery after a pre-provider failure rather than guessing its effect boundary", async () => {
  vi.mocked(buildAgentTools).mockImplementationOnce(() => {
    throw new Error("before model");
  });
  await expect(
    runAgentStep({ ...(input as object), writable: new WritableStream() } as never),
  ).rejects.toThrow("before model");
  state.attempt = 2;
  await expect(
    runAgentStep({ ...(input as object), writable: new WritableStream() } as never),
  ).rejects.toThrow("reconciliation");
  expect(streamText).not.toHaveBeenCalled();
  expect(buildAgentTools).toHaveBeenCalledTimes(1);
});
it.each([undefined, 0, NaN])(
  "refuses invalid attempt metadata %s before effects",
  async attempt => {
    state.attempt = attempt;
    await expect(
      runAgentStep({ ...(input as object), writable: new WritableStream() } as never),
    ).rejects.toThrow("reconciliation");
    expect(streamText).not.toHaveBeenCalled();
  },
);
