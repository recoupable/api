import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getResearchTrackHandler } from "../getResearchTrackHandler";
import { validateGetResearchTrackRequest } from "../validateGetResearchTrackRequest";
import { handleResearch } from "../handleResearch";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetResearchTrackRequest", () => ({
  validateGetResearchTrackRequest: vi.fn(),
}));

vi.mock("../handleResearch", () => ({
  handleResearch: vi.fn(),
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
    vi.mocked(handleResearch).mockResolvedValueOnce({
      error: "Request failed with status 502",
      status: 502,
    });
    const req = new NextRequest("http://localhost/api/research/track?q=foo");
    const res = await getResearchTrackHandler(req);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("Track search failed");
  });

  it("returns 404 when no track matches", async () => {
    vi.mocked(handleResearch).mockResolvedValueOnce({ data: { tracks: [] } });
    const req = new NextRequest("http://localhost/api/research/track?q=nothing");
    const res = await getResearchTrackHandler(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("No track found");
  });

  it("returns 'Failed to fetch track details' on detail error", async () => {
    vi.mocked(handleResearch)
      .mockResolvedValueOnce({ data: { tracks: [{ id: 12345 }] } })
      .mockResolvedValueOnce({ error: "Request failed with status 503", status: 503 });
    const req = new NextRequest("http://localhost/api/research/track?q=foo");
    const res = await getResearchTrackHandler(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("Failed to fetch track details");
  });

  it("returns 200 with track data on success", async () => {
    vi.mocked(handleResearch)
      .mockResolvedValueOnce({ data: { tracks: [{ id: 12345 }] } })
      .mockResolvedValueOnce({ data: { name: "Hotline Bling", artist: "Drake", id: 12345 } });
    const req = new NextRequest("http://localhost/api/research/track?q=Hotline+Bling");
    const res = await getResearchTrackHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.name).toBe("Hotline Bling");
  });

  it("invokes handleResearch twice on successful lookup so credits are deducted for both hops", async () => {
    vi.mocked(handleResearch)
      .mockResolvedValueOnce({ data: { tracks: [{ id: 999 }] } })
      .mockResolvedValueOnce({ data: { id: 999 } });
    const req = new NextRequest("http://localhost/api/research/track?q=foo");
    await getResearchTrackHandler(req);

    expect(handleResearch).toHaveBeenCalledTimes(2);
    expect(handleResearch).toHaveBeenNthCalledWith(1, {
      accountId: "test-id",
      path: "/search",
      query: { q: "Hotline Bling", type: "tracks", limit: "1" },
    });
    expect(handleResearch).toHaveBeenNthCalledWith(2, {
      accountId: "test-id",
      path: "/track/999",
    });
  });
});
