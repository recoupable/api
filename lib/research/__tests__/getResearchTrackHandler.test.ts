import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getResearchTrackHandler } from "../getResearchTrackHandler";
import { validateGetResearchTrackRequest } from "../validateGetResearchTrackRequest";
import { handleResearch } from "../handleResearch";
import { fetchChartmetric } from "@/lib/chartmetric/fetchChartmetric";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetResearchTrackRequest", () => ({
  validateGetResearchTrackRequest: vi.fn(),
}));

vi.mock("../handleResearch", () => ({
  handleResearch: vi.fn(),
}));

vi.mock("@/lib/chartmetric/fetchChartmetric", () => ({
  fetchChartmetric: vi.fn(),
}));

describe("getResearchTrackHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateGetResearchTrackRequest).mockResolvedValue({
      accountId: "test-id",
      q: "Hotline Bling",
    });
  });

  it("passes through validator error response", async () => {
    const err = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateGetResearchTrackRequest).mockResolvedValue(err);
    const req = new NextRequest("http://localhost/api/research/track");
    const res = await getResearchTrackHandler(req);
    expect(res).toBe(err);
  });

  it("returns 'Track search failed' when search errors", async () => {
    vi.mocked(fetchChartmetric).mockResolvedValue({ data: null, status: 502 });
    const req = new NextRequest("http://localhost/api/research/track?q=foo");
    const res = await getResearchTrackHandler(req);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("Track search failed");
  });

  it("returns 404 when no track matches", async () => {
    vi.mocked(fetchChartmetric).mockResolvedValue({ data: { tracks: [] }, status: 200 });
    const req = new NextRequest("http://localhost/api/research/track?q=nothing");
    const res = await getResearchTrackHandler(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("No track found");
  });

  it("returns 'Failed to fetch track details' on detail error", async () => {
    vi.mocked(fetchChartmetric).mockResolvedValue({
      data: { tracks: [{ id: 12345 }] },
      status: 200,
    });
    vi.mocked(handleResearch).mockResolvedValue({
      error: "Request failed with status 503",
      status: 503,
    });
    const req = new NextRequest("http://localhost/api/research/track?q=foo");
    const res = await getResearchTrackHandler(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("Failed to fetch track details");
  });

  it("returns 200 with track data on success", async () => {
    vi.mocked(fetchChartmetric).mockResolvedValue({
      data: { tracks: [{ id: 12345 }] },
      status: 200,
    });
    vi.mocked(handleResearch).mockResolvedValue({
      data: { name: "Hotline Bling", artist: "Drake", id: 12345 },
    });

    const req = new NextRequest("http://localhost/api/research/track?q=Hotline+Bling");
    const res = await getResearchTrackHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.name).toBe("Hotline Bling");
  });
});
