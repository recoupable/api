import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getScraperResultsHandler } from "../getScraperResultsHandler";
import { getActorStatus } from "../getActorStatus";
import { getDataset } from "../getDataset";
import { validateGetScraperResultsRequest } from "../validateGetScraperResultsRequest";

vi.mock("../getActorStatus", () => ({ getActorStatus: vi.fn() }));
vi.mock("../getDataset", () => ({ getDataset: vi.fn() }));
vi.mock("../validateGetScraperResultsRequest", () => ({
  validateGetScraperResultsRequest: vi.fn(),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const RUN_ID = "run_123";
const DATASET_ID = "dataset_abc";
const request = new NextRequest(`http://localhost/api/apify/runs/${RUN_ID}`);
const validated = { runId: RUN_ID };

describe("getScraperResultsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateGetScraperResultsRequest).mockResolvedValue(validated);
  });

  it("propagates validator error", async () => {
    const err = NextResponse.json({}, { status: 401 });
    vi.mocked(validateGetScraperResultsRequest).mockResolvedValue(err);
    expect(await getScraperResultsHandler(request, RUN_ID)).toBe(err);
  });

  it.each([
    ["RUNNING with dataset_id", "RUNNING", DATASET_ID],
    ["RUNNING with null dataset_id", "RUNNING", null],
    ["READY", "READY", null],
  ])("returns 200 on %s", async (_, status, dataset_id) => {
    vi.mocked(getActorStatus).mockResolvedValue({ status, dataset_id });
    const res = await getScraperResultsHandler(request, RUN_ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status, dataset_id });
  });

  it("returns 200 with data on SUCCEEDED", async () => {
    vi.mocked(getActorStatus).mockResolvedValue({
      status: "SUCCEEDED",
      dataset_id: DATASET_ID,
    });
    vi.mocked(getDataset).mockResolvedValue([{ foo: 1 }]);
    const res = await getScraperResultsHandler(request, RUN_ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "SUCCEEDED",
      dataset_id: DATASET_ID,
      data: [{ foo: 1 }],
    });
  });

  it("returns 500 when SUCCEEDED without dataset_id", async () => {
    vi.mocked(getActorStatus).mockResolvedValue({ status: "SUCCEEDED", dataset_id: null });
    const res = await getScraperResultsHandler(request, RUN_ID);
    expect(res.status).toBe(500);
  });

  it("returns 500 when dataset fetch returns null", async () => {
    vi.mocked(getActorStatus).mockResolvedValue({
      status: "SUCCEEDED",
      dataset_id: DATASET_ID,
    });
    vi.mocked(getDataset).mockResolvedValue(null);
    const res = await getScraperResultsHandler(request, RUN_ID);
    expect(res.status).toBe(500);
  });

  it.each([["FAILED"], ["ABORTED"]])("returns 500 on %s", async status => {
    vi.mocked(getActorStatus).mockResolvedValue({ status, dataset_id: DATASET_ID });
    const res = await getScraperResultsHandler(request, RUN_ID);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status, dataset_id: DATASET_ID });
  });

  it("returns 500 on thrown error", async () => {
    vi.mocked(getActorStatus).mockRejectedValue(new Error("apify down"));
    const res = await getScraperResultsHandler(request, RUN_ID);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
  });
});
