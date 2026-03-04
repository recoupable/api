import { describe, it, expect, vi, beforeEach } from "vitest";

import { pollTaskRun } from "../pollTaskRun";

const mockPoll = vi.fn();

vi.mock("@trigger.dev/sdk/v3", () => ({
  runs: {
    poll: (...args: unknown[]) => mockPoll(...args),
  },
}));

describe("pollTaskRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls runs.poll with the runId and returns the result", async () => {
    const mockRun = {
      id: "run_123",
      status: "COMPLETED",
      output: { stdout: "hello", stderr: "", exitCode: 0 },
    };
    mockPoll.mockResolvedValue(mockRun);

    const result = await pollTaskRun("run_123");

    expect(mockPoll).toHaveBeenCalledWith("run_123", {
      pollIntervalMs: 2000,
    });
    expect(result).toBe(mockRun);
  });

  it("propagates errors from runs.poll", async () => {
    mockPoll.mockRejectedValue(new Error("Poll timeout"));

    await expect(pollTaskRun("run_fail")).rejects.toThrow("Poll timeout");
  });
});
