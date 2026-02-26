import { describe, it, expect, vi, beforeEach } from "vitest";
import { runs } from "@trigger.dev/sdk/v3";
import { retrieveTaskRun } from "../retrieveTaskRun";

vi.mock("@trigger.dev/sdk/v3", () => ({
  runs: {
    retrieve: vi.fn(),
  },
}));

const baseMockRun = {
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
    vi.mocked(runs.retrieve).mockResolvedValue(baseMockRun);

    await retrieveTaskRun("run_123");

    expect(runs.retrieve).toHaveBeenCalledWith("run_123");
  });

  it("returns null when run is not found", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue(null);

    const result = await retrieveTaskRun("run_nonexistent");

    expect(result).toBeNull();
  });

  it("passes through the raw status without mapping", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue({ ...baseMockRun, status: "EXECUTING" });

    const result = await retrieveTaskRun("run_123");

    expect(result?.status).toBe("EXECUTING");
  });

  it("converts dates to ISO strings", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue(baseMockRun);

    const result = await retrieveTaskRun("run_123");

    expect(result?.createdAt).toBe("2025-01-01T00:00:00.000Z");
    expect(result?.startedAt).toBe("2025-01-01T00:00:01.000Z");
    expect(result?.finishedAt).toBe("2025-01-01T00:00:10.000Z");
  });

  it("returns null for missing optional date fields", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue({
      ...baseMockRun,
      startedAt: undefined,
      finishedAt: undefined,
    });

    const result = await retrieveTaskRun("run_123");

    expect(result?.startedAt).toBeNull();
    expect(result?.finishedAt).toBeNull();
  });

  it("includes output from the run", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue(baseMockRun);

    const result = await retrieveTaskRun("run_123");

    expect(result?.output).toEqual({ result: "ok" });
  });

  it("returns null output when not present", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue({ ...baseMockRun, output: undefined });

    const result = await retrieveTaskRun("run_123");

    expect(result?.output).toBeNull();
  });

  it("includes error from the run", async () => {
    const error = { message: "Task failed", name: "Error" };
    vi.mocked(runs.retrieve).mockResolvedValue({ ...baseMockRun, error });

    const result = await retrieveTaskRun("run_123");

    expect(result?.error).toEqual(error);
  });

  it("includes tags and metadata", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue(baseMockRun);

    const result = await retrieveTaskRun("run_123");

    expect(result?.tags).toEqual(["account:acc_123"]);
    expect(result?.metadata).toEqual({ currentStep: "Complete", logs: ["step 1"] });
  });

  it("returns null metadata when not set", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue({ ...baseMockRun, metadata: undefined });

    const result = await retrieveTaskRun("run_123");

    expect(result?.metadata).toBeNull();
  });

  it("throws error when runs.retrieve fails", async () => {
    vi.mocked(runs.retrieve).mockRejectedValue(new Error("API error"));

    await expect(retrieveTaskRun("run_123")).rejects.toThrow("API error");
  });
});
