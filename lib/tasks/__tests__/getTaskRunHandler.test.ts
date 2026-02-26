import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getTaskRunHandler } from "../getTaskRunHandler";
import { validateGetTaskRunQuery } from "../validateGetTaskRunQuery";
import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";
import { listTaskRuns } from "@/lib/trigger/listTaskRuns";

vi.mock("../validateGetTaskRunQuery", () => ({
  validateGetTaskRunQuery: vi.fn(),
}));

vi.mock("@/lib/trigger/retrieveTaskRun", () => ({
  retrieveTaskRun: vi.fn(),
}));

vi.mock("@/lib/trigger/listTaskRuns", () => ({
  listTaskRuns: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

function createMockRequest(): NextRequest {
  return {
    url: "http://localhost:3000/api/tasks/runs?runId=run_123",
    headers: new Headers({ "x-api-key": "test-key" }),
    nextUrl: new URL("http://localhost:3000/api/tasks/runs?runId=run_123"),
  } as unknown as NextRequest;
}

describe("getTaskRunHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error response when validation fails", async () => {
    vi.mocked(validateGetTaskRunQuery).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const response = await getTaskRunHandler(createMockRequest());
    expect(response.status).toBe(401);
  });

  describe("retrieve mode (runId provided)", () => {
    it("wraps a pending run in a single-element array", async () => {
      const mockRun = { id: "run_123", status: "pending" as const, taskIdentifier: "t", createdAt: "2025-01-01", startedAt: null, finishedAt: null, durationMs: null, metadata: null };
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({ mode: "retrieve", runId: "run_123" });
      vi.mocked(retrieveTaskRun).mockResolvedValue(mockRun);

      const response = await getTaskRunHandler(createMockRequest());
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(json.runs).toHaveLength(1);
      expect(json.runs[0].id).toBe("run_123");
      expect(json.runs[0].status).toBe("pending");
    });

    it("wraps a completed run in a single-element array with data", async () => {
      const taskData = { result: "ok" };
      const mockRun = { id: "run_123", status: "complete" as const, data: taskData, taskIdentifier: "t", createdAt: "2025-01-01", startedAt: null, finishedAt: null, durationMs: null, metadata: null };
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({ mode: "retrieve", runId: "run_123" });
      vi.mocked(retrieveTaskRun).mockResolvedValue(mockRun);

      const response = await getTaskRunHandler(createMockRequest());
      const json = await response.json();

      expect(json.status).toBe("success");
      expect(json.runs[0].status).toBe("complete");
      expect(json.runs[0].data).toEqual(taskData);
    });

    it("wraps a failed run in a single-element array with error", async () => {
      const mockRun = { id: "run_123", status: "failed" as const, error: "Task execution failed", taskIdentifier: "t", createdAt: "2025-01-01", startedAt: null, finishedAt: null, durationMs: null, metadata: null };
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({ mode: "retrieve", runId: "run_123" });
      vi.mocked(retrieveTaskRun).mockResolvedValue(mockRun);

      const response = await getTaskRunHandler(createMockRequest());
      const json = await response.json();

      expect(json.status).toBe("success");
      expect(json.runs[0].status).toBe("failed");
      expect(json.runs[0].error).toBe("Task execution failed");
    });

    it("returns 404 when run is not found", async () => {
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({ mode: "retrieve", runId: "run_nonexistent" });
      vi.mocked(retrieveTaskRun).mockResolvedValue(null);

      const response = await getTaskRunHandler(createMockRequest());
      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.status).toBe("error");
      expect(json.error).toContain("not found");
    });

    it("returns 500 error when retrieveTaskRun throws", async () => {
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({ mode: "retrieve", runId: "run_123" });
      vi.mocked(retrieveTaskRun).mockRejectedValue(new Error("Trigger.dev API error"));

      const response = await getTaskRunHandler(createMockRequest());
      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBe("Trigger.dev API error");
    });
  });

  describe("list mode (no runId)", () => {
    it("returns empty runs array when no runs found", async () => {
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({ mode: "list", accountId: "acc_123", limit: 20 });
      vi.mocked(listTaskRuns).mockResolvedValue([]);

      const response = await getTaskRunHandler(createMockRequest());
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({ status: "success", runs: [] });
    });

    it("returns populated runs array", async () => {
      const mockRuns = [
        { id: "run_1", status: "complete" as const, data: null, taskIdentifier: "run-sandbox-command", createdAt: "2025-01-01", startedAt: null, finishedAt: null, durationMs: 5000, metadata: null },
      ];
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({ mode: "list", accountId: "acc_123", limit: 20 });
      vi.mocked(listTaskRuns).mockResolvedValue(mockRuns);

      const response = await getTaskRunHandler(createMockRequest());
      const json = await response.json();

      expect(json.status).toBe("success");
      expect(json.runs).toHaveLength(1);
      expect(json.runs[0].id).toBe("run_1");
    });

    it("calls listTaskRuns with accountId and limit", async () => {
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({ mode: "list", accountId: "acc_456", limit: 50 });
      vi.mocked(listTaskRuns).mockResolvedValue([]);

      await getTaskRunHandler(createMockRequest());

      expect(listTaskRuns).toHaveBeenCalledWith("acc_456", 50);
    });

    it("returns 500 error when listTaskRuns throws", async () => {
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({ mode: "list", accountId: "acc_123", limit: 20 });
      vi.mocked(listTaskRuns).mockRejectedValue(new Error("Trigger.dev API error"));

      const response = await getTaskRunHandler(createMockRequest());
      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBe("Trigger.dev API error");
    });
  });
});
