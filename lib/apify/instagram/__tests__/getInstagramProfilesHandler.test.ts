import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getInstagramProfilesHandler } from "../getInstagramProfilesHandler";
import { startInstagramProfileScraping } from "../startInstagramProfileScraping";
import { validateGetInstagramProfilesRequest } from "../validateGetInstagramProfilesRequest";

vi.mock("../startInstagramProfileScraping", () => ({
  startInstagramProfileScraping: vi.fn(),
}));
vi.mock("../validateGetInstagramProfilesRequest", () => ({
  validateGetInstagramProfilesRequest: vi.fn(),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const request = new NextRequest("http://localhost/api/instagram/profiles?handles=a");

describe("getInstagramProfilesHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateGetInstagramProfilesRequest).mockResolvedValue({ handles: ["a"] });
  });

  it("propagates validator error", async () => {
    const err = NextResponse.json({}, { status: 400 });
    vi.mocked(validateGetInstagramProfilesRequest).mockResolvedValue(err);
    expect(await getInstagramProfilesHandler(request)).toBe(err);
  });

  it("returns 200 with runId and datasetId on success", async () => {
    vi.mocked(startInstagramProfileScraping).mockResolvedValue({
      runId: "run_1",
      datasetId: "dataset_1",
    });
    const res = await getInstagramProfilesHandler(request);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ runId: "run_1", datasetId: "dataset_1" });
  });

  it("returns 500 when scraping helper returns null", async () => {
    vi.mocked(startInstagramProfileScraping).mockResolvedValue(null);
    const res = await getInstagramProfilesHandler(request);
    expect(res.status).toBe(500);
  });

  it("returns generic 500 on thrown error without leaking message", async () => {
    vi.mocked(startInstagramProfileScraping).mockRejectedValue(new Error("apify at 10.0.0.1 down"));
    const res = await getInstagramProfilesHandler(request);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ status: "error", error: "Internal server error" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.1");
  });
});
