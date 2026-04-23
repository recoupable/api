import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getScraperResultsHandler } from "../getScraperResultsHandler";
import apifyClient from "@/lib/apify/client";
import { validateGetScraperResultsRequest } from "../validateGetScraperResultsRequest";

vi.mock("@/lib/apify/client", () => ({
  default: { run: vi.fn(), dataset: vi.fn() },
}));
vi.mock("../validateGetScraperResultsRequest", () => ({
  validateGetScraperResultsRequest: vi.fn(),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const RUN_ID = "run_123";
const DATASET_ID = "dataset_abc";
const request = new NextRequest(`http://localhost/api/apify/runs/${RUN_ID}`);

const mockRun = (run: unknown) =>
  vi
    .mocked(apifyClient.run)
    .mockImplementation(() => ({ get: () => Promise.resolve(run) }) as never);
const mockDataset = (result: unknown) =>
  vi
    .mocked(apifyClient.dataset)
    .mockImplementation(() => ({ listItems: () => Promise.resolve(result) }) as never);

describe("getScraperResultsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateGetScraperResultsRequest).mockResolvedValue({ runId: RUN_ID });
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
  ])("returns 200 on %s", async (_, status, defaultDatasetId) => {
    mockRun({ status, defaultDatasetId });
    const res = await getScraperResultsHandler(request, RUN_ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status, dataset_id: defaultDatasetId });
  });

  it("returns 200 with data on SUCCEEDED", async () => {
    mockRun({ status: "SUCCEEDED", defaultDatasetId: DATASET_ID });
    mockDataset({ items: [{ foo: 1 }] });
    const res = await getScraperResultsHandler(request, RUN_ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "SUCCEEDED",
      dataset_id: DATASET_ID,
      data: [{ foo: 1 }],
    });
  });

  it("returns 500 when SUCCEEDED without dataset_id", async () => {
    mockRun({ status: "SUCCEEDED" });
    const res = await getScraperResultsHandler(request, RUN_ID);
    expect(res.status).toBe(500);
  });

  it("returns 500 when dataset fetch returns null", async () => {
    mockRun({ status: "SUCCEEDED", defaultDatasetId: DATASET_ID });
    mockDataset(null);
    const res = await getScraperResultsHandler(request, RUN_ID);
    expect(res.status).toBe(500);
  });

  it.each([["FAILED"], ["ABORTED"]])("returns 500 on %s", async status => {
    mockRun({ status, defaultDatasetId: DATASET_ID });
    const res = await getScraperResultsHandler(request, RUN_ID);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status, dataset_id: DATASET_ID });
  });

  it("returns 500 on thrown error", async () => {
    vi.mocked(apifyClient.run).mockImplementation(
      () => ({ get: () => Promise.reject(new Error("apify down")) }) as never,
    );
    const res = await getScraperResultsHandler(request, RUN_ID);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
  });
});
