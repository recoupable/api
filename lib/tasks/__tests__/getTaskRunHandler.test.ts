import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getTaskRunHandler } from "../getTaskRunHandler";
import { validateGetTaskRunQuery } from "../validateGetTaskRunQuery";
import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";
import { fetchTriggerRuns } from "@/lib/trigger/fetchTriggerRuns";

vi.mock("../validateGetTaskRunQuery", () => ({
  validateGetTaskRunQuery: vi.fn(),
}));

vi.mock("@/lib/trigger/retrieveTaskRun", () => ({
  retrieveTaskRun: vi.fn(),
}));

vi.mock("@/lib/trigger/fetchTriggerRuns", () => ({
  fetchTriggerRuns: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

/**
 * Creates a minimal mock NextRequest for the task run endpoint with an x-api-key header.
 *
 * @returns A minimal NextRequest-shaped object for use in handler tests
 */
function createMockRequest(): NextRequest {
  return {
    url: "http://localhost:3000/api/tasks/runs",
    headers: new Headers({ "x-api-key": "test-key" }),
    nextUrl: new URL("http://localhost:3000/api/tasks/runs"),
  } as unknown as NextRequest;
}

const mockRun = {
  id: "run_123",
  status: "COMPLETED",
  taskIdentifier: "run-sandbox-command",
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  startedAt: null,
  finishedAt: null,
  durationMs: 5000,
  tags: ["account:acc_123"],
  metadata: null,
  output: { result: "ok" },
  error: null,
};

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

  describe("retrieve mode", () => {
    it("wraps a single run in { status, runs[] }", async () => {
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({ mode: "retrieve", runId: "run_123" });
      vi.mocked(retrieveTaskRun).mockResolvedValue(mockRun);

      const response = await getTaskRunHandler(createMockRequest());
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(json.runs).toHaveLength(1);
      expect(json.runs[0].id).toBe("run_123");
    });

    it("returns 404 when run is not found", async () => {
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({ mode: "retrieve", runId: "run_x" });
      vi.mocked(retrieveTaskRun).mockResolvedValue(null);

      const response = await getTaskRunHandler(createMockRequest());
      expect(response.status).toBe(404);
    });

    it("returns 500 when retrieveTaskRun throws", async () => {
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({ mode: "retrieve", runId: "run_123" });
      vi.mocked(retrieveTaskRun).mockRejectedValue(new Error("API error"));

      const response = await getTaskRunHandler(createMockRequest());
      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBe("API error");
    });
  });

  describe("list mode", () => {
    it("returns empty runs array", async () => {
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({
        mode: "list",
        accountId: "acc_123",
        limit: 20,
      });
      vi.mocked(fetchTriggerRuns).mockResolvedValue([]);

      const response = await getTaskRunHandler(createMockRequest());
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({ status: "success", runs: [] });
    });

    it("returns populated runs array", async () => {
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({
        mode: "list",
        accountId: "acc_123",
        limit: 20,
      });
      vi.mocked(fetchTriggerRuns).mockResolvedValue([mockRun]);

      const response = await getTaskRunHandler(createMockRequest());
      const json = await response.json();

      expect(json.status).toBe("success");
      expect(json.runs).toHaveLength(1);
    });

    it("calls fetchTriggerRuns with accountId and limit", async () => {
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({
        mode: "list",
        accountId: "acc_456",
        limit: 50,
      });
      vi.mocked(fetchTriggerRuns).mockResolvedValue([]);

      await getTaskRunHandler(createMockRequest());

      expect(fetchTriggerRuns).toHaveBeenCalledWith({ "filter[tag]": "account:acc_456" }, 50);
    });

    it("returns 500 when fetchTriggerRuns throws", async () => {
      vi.mocked(validateGetTaskRunQuery).mockResolvedValue({
        mode: "list",
        accountId: "acc_123",
        limit: 20,
      });
      vi.mocked(fetchTriggerRuns).mockRejectedValue(new Error("API error"));

      const response = await getTaskRunHandler(createMockRequest());
      expect(response.status).toBe(500);
    });
  });
});
