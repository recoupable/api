import { describe, it, expect, vi, beforeEach } from "vitest";
import { triggerSetupSandbox } from "@/lib/trigger/triggerSetupSandbox";

import { tasks } from "@trigger.dev/sdk";

vi.mock("@trigger.dev/sdk", () => ({
  tasks: {
    trigger: vi.fn(),
  },
}));

describe("triggerSetupSandbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("triggers the setup-sandbox task with the accountId", async () => {
    const mockHandle = { id: "run_abc123" };
    vi.mocked(tasks.trigger).mockResolvedValue(mockHandle as never);

    const result = await triggerSetupSandbox("account-uuid-123");

    expect(tasks.trigger).toHaveBeenCalledWith("setup-sandbox", {
      accountId: "account-uuid-123",
    });
    expect(result).toEqual(mockHandle);
  });

  it("returns the task handle with runId", async () => {
    const mockHandle = { id: "run_xyz789" };
    vi.mocked(tasks.trigger).mockResolvedValue(mockHandle as never);

    const result = await triggerSetupSandbox("another-account-id");

    expect(result.id).toBe("run_xyz789");
  });
});
