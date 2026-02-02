import { describe, it, expect, vi, beforeEach } from "vitest";
import { tasks } from "@trigger.dev/sdk";
import { triggerRunSandboxCommand } from "../triggerRunSandboxCommand";

vi.mock("@trigger.dev/sdk", () => ({
  tasks: {
    trigger: vi.fn(),
  },
}));

describe("triggerRunSandboxCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("triggers run-sandbox-command task with correct payload", async () => {
    const mockHandle = { id: "task_123" };
    vi.mocked(tasks.trigger).mockResolvedValue(mockHandle);

    const payload = {
      prompt: "tell me hello",
      sandboxId: "sbx_456",
    };

    const result = await triggerRunSandboxCommand(payload);

    expect(tasks.trigger).toHaveBeenCalledWith("run-sandbox-command", payload);
    expect(result).toEqual(mockHandle);
  });

  it("passes through the task handle from trigger", async () => {
    const mockHandle = { id: "task_789", publicAccessToken: "token_abc" };
    vi.mocked(tasks.trigger).mockResolvedValue(mockHandle);

    const result = await triggerRunSandboxCommand({
      prompt: "another prompt",
      sandboxId: "sbx_999",
    });

    expect(result).toBe(mockHandle);
  });
});
