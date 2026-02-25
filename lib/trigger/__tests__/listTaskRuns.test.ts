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

  it("maps run data to TaskRunListItem format", async () => {
    const mockRun = {
      id: "run_abc",
      status: "COMPLETED",
      taskIdentifier: "run-sandbox-command",
      createdAt: new Date("2025-06-01T10:00:00Z"),
      startedAt: new Date("2025-06-01T10:00:01Z"),
      finishedAt: new Date("2025-06-01T10:00:05Z"),
      durationMs: 4000,
      tags: ["account:acc_123"],
    };
    vi.mocked(runs.list).mockResolvedValue({ data: [mockRun] } as never);

    const result = await listTaskRuns("acc_123");

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "run_abc",
      status: "COMPLETED",
      taskIdentifier: "run-sandbox-command",
      createdAt: new Date("2025-06-01T10:00:00Z"),
      startedAt: new Date("2025-06-01T10:00:01Z"),
      finishedAt: new Date("2025-06-01T10:00:05Z"),
      durationMs: 4000,
      tags: ["account:acc_123"],
    });
  });

  it("handles runs with null optional fields", async () => {
    const mockRun = {
      id: "run_xyz",
      status: "QUEUED",
      taskIdentifier: "customer-prompt-task",
      createdAt: new Date("2025-06-01T10:00:00Z"),
      // No startedAt, finishedAt, durationMs, or tags
    };
    vi.mocked(runs.list).mockResolvedValue({ data: [mockRun] } as never);

    const result = await listTaskRuns("acc_123");

    expect(result).toHaveLength(1);
    expect(result[0].startedAt).toBeNull();
    expect(result[0].finishedAt).toBeNull();
    expect(result[0].durationMs).toBeNull();
    expect(result[0].tags).toEqual([]);
  });

  it("returns empty array when no runs match", async () => {
    vi.mocked(runs.list).mockResolvedValue({ data: [] } as never);

    const result = await listTaskRuns("acc_no_runs");

    expect(result).toEqual([]);
  });
});
