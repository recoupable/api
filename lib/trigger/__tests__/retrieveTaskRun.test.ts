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
  taskIdentifier: "setup-sandbox",
  metadata: { currentStep: "Complete", logs: ["step 1"] },
  createdAt: new Date("2025-01-01T00:00:00Z"),
  startedAt: new Date("2025-01-01T00:00:01Z"),
  finishedAt: new Date("2025-01-01T00:00:10Z"),
  durationMs: 9000,
};

const expectedCommon = {
  metadata: baseMockRun.metadata,
  taskIdentifier: "setup-sandbox",
  createdAt: "2025-01-01T00:00:00.000Z",
  startedAt: "2025-01-01T00:00:01.000Z",
  finishedAt: "2025-01-01T00:00:10.000Z",
  durationMs: 9000,
};

describe("retrieveTaskRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls runs.retrieve with the provided runId", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue({
      ...baseMockRun,
      status: "COMPLETED",
      output: { result: "success" },
    });

    await retrieveTaskRun("run_123");

    expect(runs.retrieve).toHaveBeenCalledWith("run_123");
  });

  it("returns pending status when run status is EXECUTING", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue({
      ...baseMockRun,
      status: "EXECUTING",
      finishedAt: null,
      durationMs: null,
    });

    const result = await retrieveTaskRun("run_123");

    expect(result).toEqual({
      ...expectedCommon,
      status: "pending",
      finishedAt: null,
      durationMs: null,
    });
  });

  it("returns pending status when run status is QUEUED", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue({
      ...baseMockRun,
      status: "QUEUED",
      startedAt: null,
      finishedAt: null,
      durationMs: null,
    });

    const result = await retrieveTaskRun("run_123");

    expect(result).toEqual({
      ...expectedCommon,
      status: "pending",
      startedAt: null,
      finishedAt: null,
      durationMs: null,
    });
  });

  it("returns pending status when run status is REATTEMPTING", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue({
      ...baseMockRun,
      status: "REATTEMPTING",
      finishedAt: null,
      durationMs: null,
    });

    const result = await retrieveTaskRun("run_123");

    expect(result).toEqual({
      ...expectedCommon,
      status: "pending",
      finishedAt: null,
      durationMs: null,
    });
  });

  it("returns complete status with data when run status is COMPLETED", async () => {
    const outputData = { message: "Task completed successfully" };
    vi.mocked(runs.retrieve).mockResolvedValue({
      ...baseMockRun,
      status: "COMPLETED",
      output: outputData,
    });

    const result = await retrieveTaskRun("run_123");

    expect(result).toEqual({ ...expectedCommon, status: "complete", data: outputData });
  });

  it("returns complete status with null data when output is undefined", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue({
      ...baseMockRun,
      status: "COMPLETED",
      output: undefined,
    });

    const result = await retrieveTaskRun("run_123");

    expect(result).toEqual({ ...expectedCommon, status: "complete", data: null });
  });

  it("returns failed status with error when run status is FAILED", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue({
      ...baseMockRun,
      status: "FAILED",
      error: { message: "Task execution failed" },
    });

    const result = await retrieveTaskRun("run_123");

    expect(result).toEqual({
      ...expectedCommon,
      status: "failed",
      error: "Task execution failed",
    });
  });

  it("returns failed status with error when run status is CRASHED", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue({
      ...baseMockRun,
      status: "CRASHED",
      error: { message: "Task crashed unexpectedly" },
    });

    const result = await retrieveTaskRun("run_123");

    expect(result).toEqual({
      ...expectedCommon,
      status: "failed",
      error: "Task crashed unexpectedly",
    });
  });

  it("returns failed status with error when run status is CANCELED", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue({
      ...baseMockRun,
      status: "CANCELED",
    });

    const result = await retrieveTaskRun("run_123");

    expect(result).toEqual({
      ...expectedCommon,
      status: "failed",
      error: "Task was canceled",
    });
  });

  it("returns failed status with generic error when error message is not available", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue({
      ...baseMockRun,
      status: "FAILED",
    });

    const result = await retrieveTaskRun("run_123");

    expect(result).toEqual({
      ...expectedCommon,
      status: "failed",
      error: "Task execution failed",
    });
  });

  it("returns null metadata when metadata is not set", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue({
      ...baseMockRun,
      status: "COMPLETED",
      output: null,
      metadata: undefined,
    });

    const result = await retrieveTaskRun("run_123");

    expect(result?.metadata).toBeNull();
  });

  it("throws error when runs.retrieve fails", async () => {
    vi.mocked(runs.retrieve).mockRejectedValue(new Error("API error"));

    await expect(retrieveTaskRun("run_123")).rejects.toThrow("API error");
  });
});
