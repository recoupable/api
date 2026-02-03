import { describe, it, expect, vi, beforeEach } from "vitest";
import { runs } from "@trigger.dev/sdk/v3";
import { retrieveTaskRun } from "../retrieveTaskRun";

vi.mock("@trigger.dev/sdk/v3", () => ({
  runs: {
    retrieve: vi.fn(),
  },
}));

describe("retrieveTaskRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls runs.retrieve with the provided runId", async () => {
    const mockRun = {
      id: "run_123",
      status: "COMPLETED",
      output: { result: "success" },
    };
    vi.mocked(runs.retrieve).mockResolvedValue(mockRun);

    await retrieveTaskRun("run_123");

    expect(runs.retrieve).toHaveBeenCalledWith("run_123");
  });

  it("returns pending status when run status is EXECUTING", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue({
      id: "run_123",
      status: "EXECUTING",
    });

    const result = await retrieveTaskRun("run_123");

    expect(result).toEqual({ status: "pending" });
  });

  it("returns pending status when run status is QUEUED", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue({
      id: "run_123",
      status: "QUEUED",
    });

    const result = await retrieveTaskRun("run_123");

    expect(result).toEqual({ status: "pending" });
  });

  it("returns pending status when run status is REATTEMPTING", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue({
      id: "run_123",
      status: "REATTEMPTING",
    });

    const result = await retrieveTaskRun("run_123");

    expect(result).toEqual({ status: "pending" });
  });

  it("returns complete status with data when run status is COMPLETED", async () => {
    const outputData = { message: "Task completed successfully" };
    vi.mocked(runs.retrieve).mockResolvedValue({
      id: "run_123",
      status: "COMPLETED",
      output: outputData,
    });

    const result = await retrieveTaskRun("run_123");

    expect(result).toEqual({ status: "complete", data: outputData });
  });

  it("returns complete status with null data when output is undefined", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue({
      id: "run_123",
      status: "COMPLETED",
      output: undefined,
    });

    const result = await retrieveTaskRun("run_123");

    expect(result).toEqual({ status: "complete", data: null });
  });

  it("returns failed status with error when run status is FAILED", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue({
      id: "run_123",
      status: "FAILED",
      error: { message: "Task execution failed" },
    });

    const result = await retrieveTaskRun("run_123");

    expect(result).toEqual({
      status: "failed",
      error: "Task execution failed",
    });
  });

  it("returns failed status with error when run status is CRASHED", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue({
      id: "run_123",
      status: "CRASHED",
      error: { message: "Task crashed unexpectedly" },
    });

    const result = await retrieveTaskRun("run_123");

    expect(result).toEqual({
      status: "failed",
      error: "Task crashed unexpectedly",
    });
  });

  it("returns failed status with error when run status is CANCELED", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue({
      id: "run_123",
      status: "CANCELED",
    });

    const result = await retrieveTaskRun("run_123");

    expect(result).toEqual({
      status: "failed",
      error: "Task was canceled",
    });
  });

  it("returns failed status with generic error when error message is not available", async () => {
    vi.mocked(runs.retrieve).mockResolvedValue({
      id: "run_123",
      status: "FAILED",
    });

    const result = await retrieveTaskRun("run_123");

    expect(result).toEqual({
      status: "failed",
      error: "Task execution failed",
    });
  });

  it("throws error when runs.retrieve fails", async () => {
    vi.mocked(runs.retrieve).mockRejectedValue(new Error("API error"));

    await expect(retrieveTaskRun("run_123")).rejects.toThrow("API error");
  });
});
