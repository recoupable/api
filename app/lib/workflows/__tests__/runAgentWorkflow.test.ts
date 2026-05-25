import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAgentWorkflow } from "@/app/lib/workflows/runAgentWorkflow";
import { runAgentStep } from "@/app/lib/workflows/runAgentStep";
import { clearChatActiveStream } from "@/lib/chat/clearChatActiveStream";

vi.mock("@/app/lib/workflows/runAgentStep", () => ({
  runAgentStep: vi.fn(),
}));
vi.mock("@/lib/chat/clearChatActiveStream", () => ({
  clearChatActiveStream: vi.fn(),
}));
vi.mock("workflow", () => ({
  getWritable: vi.fn(() => new WritableStream()),
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
    vi.mocked(runAgentStep).mockResolvedValue({ finishReason: "stop" });

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
});
