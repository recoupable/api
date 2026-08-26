import { describe, it, expect, vi, beforeEach } from "vitest";
import { linkTriggerRunToWorkflow } from "@/lib/chat/runs/linkTriggerRunToWorkflow";
import { updateTriggerRunMetadata } from "@/lib/trigger/updateTriggerRunMetadata";
import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";

vi.mock("@/lib/trigger/updateTriggerRunMetadata", () => ({
  updateTriggerRunMetadata: vi.fn(async () => true),
}));
vi.mock("@/lib/trigger/retrieveTaskRun", () => ({
  retrieveTaskRun: vi.fn(),
}));

const input = {
  triggerRunId: "run_trig",
  accountId: "acc-1",
  sessionId: "sess-1",
  chatId: "chat-1",
  workflowRunId: "wrun_abc",
};

describe("linkTriggerRunToWorkflow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("writes the link when the Trigger run carries the caller's account tag", async () => {
    vi.mocked(retrieveTaskRun).mockResolvedValue({ tags: ["account:acc-1"] } as never);
    await linkTriggerRunToWorkflow(input);
    expect(updateTriggerRunMetadata).toHaveBeenCalledWith("run_trig", {
      sessionId: "sess-1",
      chatId: "chat-1",
      workflowRunId: "wrun_abc",
    });
  });

  it("refuses to write onto a run tagged for a different account", async () => {
    vi.mocked(retrieveTaskRun).mockResolvedValue({ tags: ["account:someone-else"] } as never);
    await linkTriggerRunToWorkflow(input);
    expect(updateTriggerRunMetadata).not.toHaveBeenCalled();
  });

  it("refuses when the run cannot be retrieved or has no account tag", async () => {
    vi.mocked(retrieveTaskRun).mockResolvedValue(null as never);
    await linkTriggerRunToWorkflow(input);
    vi.mocked(retrieveTaskRun).mockRejectedValue(new Error("boom"));
    await expect(linkTriggerRunToWorkflow(input)).resolves.toBeUndefined();
    expect(updateTriggerRunMetadata).not.toHaveBeenCalled();
  });
});
