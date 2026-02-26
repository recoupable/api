import { describe, it, expect, vi, beforeEach } from "vitest";
import { runs } from "@trigger.dev/sdk/v3";
import { retrieveTaskRun } from "../retrieveTaskRun";

vi.mock("@trigger.dev/sdk/v3", () => ({
  runs: {
    retrieve: vi.fn(),
  },
}));

const mockRun = {
  id: "run_123",
  status: "COMPLETED",
  taskIdentifier: "setup-sandbox",
  metadata: { currentStep: "Complete", logs: ["step 1"] },
  createdAt: new Date("2025-01-01T00:00:00Z"),
  startedAt: new Date("2025-01-01T00:00:01Z"),
  finishedAt: new Date("2025-01-01T00:00:10Z"),
  durationMs: 9000,
  tags: ["account:acc_123"],
  output: { result: "ok" },
  error: null,
};

describe("retrieveTaskRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls runs.retrieve with the provided runId", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue(mockRun);

    await retrieveTaskRun("run_123");

    expect(runs.retrieve).toHaveBeenCalledWith("run_123");
  });

  it("returns null when run is not found", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue(null);

    const result = await retrieveTaskRun("run_nonexistent");

    expect(result).toBeNull();
  });

  it("returns the raw SDK object without mapping", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue(mockRun);

    const result = await retrieveTaskRun("run_123");

    expect(result).toBe(mockRun);
  });

  it("throws error when runs.retrieve fails", async () => {
    vi.mocked(runs.retrieve).mockRejectedValue(new Error("API error"));

    await expect(retrieveTaskRun("run_123")).rejects.toThrow("API error");
  });
});
