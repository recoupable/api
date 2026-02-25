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

/**
 * Creates a mock NextRequest for testing.
 */
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

  describe("retrieve mode", () => {
    it("returns error response when validation fails (auth or query)", async () => {
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue(
        NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
      );

      const request = createMockRequest();
      const response = await getTaskRunHandler(request);

      expect(response.status).toBe(401);
    });

    it("returns pending status when task is still running", async () => {
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({
        mode: "retrieve",
        runId: "run_123",
      });
      vi.mocked(retrieveTaskRun).mockResolvedValue({ status: "pending" });

      const request = createMockRequest();
      const response = await getTaskRunHandler(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ status: "pending" });
    });

    it("returns complete status with data when task is completed", async () => {
      const taskData = { result: "success", details: { foo: "bar" } };
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({
        mode: "retrieve",
        runId: "run_123",
      });
      vi.mocked(retrieveTaskRun).mockResolvedValue({ status: "complete", data: taskData });

      const request = createMockRequest();
      const response = await getTaskRunHandler(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ status: "complete", data: taskData });
    });

    it("returns failed status with error when task failed", async () => {
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({
        mode: "retrieve",
        runId: "run_123",
      });
      vi.mocked(retrieveTaskRun).mockResolvedValue({
        status: "failed",
        error: "Task execution failed",
      });

      const request = createMockRequest();
      const response = await getTaskRunHandler(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ status: "failed", error: "Task execution failed" });
    });

    it("calls retrieveTaskRun with the validated runId", async () => {
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({
        mode: "retrieve",
        runId: "run_specific_id",
      });
      vi.mocked(retrieveTaskRun).mockResolvedValue({ status: "pending" });

      const request = createMockRequest();
      await getTaskRunHandler(request);

      expect(retrieveTaskRun).toHaveBeenCalledWith("run_specific_id");
    });

    it("returns 500 error when retrieveTaskRun throws", async () => {
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({
        mode: "retrieve",
        runId: "run_123",
      });
      vi.mocked(retrieveTaskRun).mockRejectedValue(new Error("Trigger.dev API error"));

      const request = createMockRequest();
      const response = await getTaskRunHandler(request);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.status).toBe("error");
      expect(json.error).toBe("Trigger.dev API error");
    });

    it("returns 404 when run is not found", async () => {
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({
        mode: "retrieve",
        runId: "run_nonexistent",
      });
      vi.mocked(retrieveTaskRun).mockResolvedValue(null);

      const request = createMockRequest();
      const response = await getTaskRunHandler(request);

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.status).toBe("error");
      expect(json.error).toContain("not found");
    });
  });

  describe("list mode", () => {
    it("returns empty runs array when no runs found", async () => {
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({
        mode: "list",
        accountId: "acc_123",
        limit: 20,
      });
      vi.mocked(listTaskRuns).mockResolvedValue([]);

      const request = createMockRequest();
      const response = await getTaskRunHandler(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ status: "success", runs: [] });
    });

    it("returns populated runs array", async () => {
      const mockRuns = [
        {
          id: "run_1",
          status: "COMPLETED",
          taskIdentifier: "run-sandbox-command",
          createdAt: new Date("2025-01-01"),
          startedAt: new Date("2025-01-01"),
          finishedAt: new Date("2025-01-01"),
          durationMs: 5000,
          tags: ["account:acc_123"],
        },
      ];
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({
        mode: "list",
        accountId: "acc_123",
        limit: 20,
      });
      vi.mocked(listTaskRuns).mockResolvedValue(mockRuns);

      const request = createMockRequest();
      const response = await getTaskRunHandler(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.status).toBe("success");
      expect(json.runs).toHaveLength(1);
      expect(json.runs[0].id).toBe("run_1");
    });

    it("calls listTaskRuns with accountId and limit", async () => {
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({
        mode: "list",
        accountId: "acc_456",
        limit: 50,
      });
      vi.mocked(listTaskRuns).mockResolvedValue([]);

      const request = createMockRequest();
      await getTaskRunHandler(request);

      expect(listTaskRuns).toHaveBeenCalledWith("acc_456", 50);
    });

    it("returns 500 error when listTaskRuns throws", async () => {
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({
        mode: "list",
        accountId: "acc_123",
        limit: 20,
      });
      vi.mocked(listTaskRuns).mockRejectedValue(new Error("Trigger.dev API error"));

      const request = createMockRequest();
      const response = await getTaskRunHandler(request);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.status).toBe("error");
      expect(json.error).toBe("Trigger.dev API error");
    });
  });
});
