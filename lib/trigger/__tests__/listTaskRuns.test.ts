import { describe, it, expect, vi, beforeEach } from "vitest";
import { listTaskRuns } from "../listTaskRuns";
import { runs } from "@trigger.dev/sdk/v3";

vi.mock("@trigger.dev/sdk/v3", () => ({
  runs: {
    list: vi.fn(),
  },
}));

describe("listTaskRuns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls runs.list with correct tag filter and limit", async () => {
    vi.mocked(runs.list).mockResolvedValue({ data: [] } as never);

    await listTaskRuns("acc_123", 10);

    expect(runs.list).toHaveBeenCalledWith({
      tag: ["account:acc_123"],
      limit: 10,
    });
  });

  it("uses default limit of 20", async () => {
    vi.mocked(runs.list).mockResolvedValue({ data: [] } as never);

    await listTaskRuns("acc_123");

    expect(runs.list).toHaveBeenCalledWith({
      tag: ["account:acc_123"],
      limit: 20,
    });
  });

  it("returns the raw SDK data array without mapping", async () => {
    const mockRuns = [
      { id: "run_abc", status: "COMPLETED", taskIdentifier: "run-sandbox-command" },
      { id: "run_def", status: "EXECUTING", taskIdentifier: "customer-prompt-task" },
    ];
    vi.mocked(runs.list).mockResolvedValue({ data: mockRuns } as never);

    const result = await listTaskRuns("acc_123");

    expect(result).toBe(mockRuns);
  });

  it("returns empty array when no runs match", async () => {
    vi.mocked(runs.list).mockResolvedValue({ data: [] } as never);

    const result = await listTaskRuns("acc_no_runs");

    expect(result).toEqual([]);
  });
});
