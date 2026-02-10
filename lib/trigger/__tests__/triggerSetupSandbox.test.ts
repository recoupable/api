import { describe, it, expect, vi, beforeEach } from "vitest";
import { tasks } from "@trigger.dev/sdk";
import { triggerSetupSandbox } from "../triggerSetupSandbox";

vi.mock("@trigger.dev/sdk", () => ({
  tasks: {
    trigger: vi.fn(),
  },
}));

describe("triggerSetupSandbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("triggers setup-sandbox task with correct payload", async () => {
    const mockHandle = { id: "run_123" };
    vi.mocked(tasks.trigger).mockResolvedValue(mockHandle);

    const payload = {
      sandboxId: "sbx_456",
      accountId: "acc_123",
    };

    const result = await triggerSetupSandbox(payload);

    expect(tasks.trigger).toHaveBeenCalledWith("setup-sandbox", payload);
    expect(result).toEqual(mockHandle);
  });

  it("passes through the task handle from trigger", async () => {
    const mockHandle = { id: "run_789", publicAccessToken: "token_abc" };
    vi.mocked(tasks.trigger).mockResolvedValue(mockHandle);

    const result = await triggerSetupSandbox({
      sandboxId: "sbx_999",
      accountId: "acc_456",
    });

    expect(result).toBe(mockHandle);
  });
});
