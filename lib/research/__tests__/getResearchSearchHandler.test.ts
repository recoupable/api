import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getResearchSearchHandler } from "../getResearchSearchHandler";
import { validateGetResearchSearchRequest } from "../validateGetResearchSearchRequest";
import { handleResearch } from "../handleResearch";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetResearchSearchRequest", () => ({
  validateGetResearchSearchRequest: vi.fn(),
}));

vi.mock("../handleResearch", () => ({
  handleResearch: vi.fn(),
}));

describe("getResearchSearchHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateGetResearchSearchRequest).mockResolvedValue({
      accountId: "test-id",
      q: "Drake",
      type: "artists",
      limit: "10",
      beta: undefined,
      platforms: undefined,
      offset: undefined,
    });
  });

  it("passes through validator error response", async () => {
    const err = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateGetResearchSearchRequest).mockResolvedValue(err);
    const req = new NextRequest("http://localhost/api/research/search");
    const res = await getResearchSearchHandler(req);
    expect(res).toBe(err);
  });

  it("returns 'Search failed' on upstream error", async () => {
    vi.mocked(handleResearch).mockResolvedValue({
      error: "Request failed with status 502",
      status: 502,
    });
    const req = new NextRequest("http://localhost/api/research/search?q=Drake");
    const res = await getResearchSearchHandler(req);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("Search failed");
  });

  it("returns 200 with results on success", async () => {
    vi.mocked(handleResearch).mockResolvedValue({
      data: { artists: [{ name: "Drake", id: 3380 }] },
    });
    const req = new NextRequest("http://localhost/api/research/search?q=Drake");
    const res = await getResearchSearchHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.results).toEqual([{ name: "Drake", id: 3380 }]);
  });

  it("forwards only the defaulted params to Chartmetric when no optional params are provided", async () => {
    vi.mocked(handleResearch).mockResolvedValue({ data: { artists: [] } });
    const req = new NextRequest("http://localhost/api/research/search?q=Drake");
    await getResearchSearchHandler(req);

    expect(handleResearch).toHaveBeenCalledWith({
      accountId: "test-id",
      path: "/search",
      query: { q: "Drake", type: "artists", limit: "10" },
    });
  });

  it("forwards beta, platforms, and offset to Chartmetric when provided", async () => {
    vi.mocked(validateGetResearchSearchRequest).mockResolvedValue({
      accountId: "test-id",
      q: "Hotline Bling",
      type: "tracks",
      limit: "25",
      beta: "true",
      platforms: "cm,spotify",
      offset: "5",
    });
    vi.mocked(handleResearch).mockResolvedValue({ data: { tracks: [] } });
    const req = new NextRequest(
      "http://localhost/api/research/search?q=Hotline+Bling&type=tracks&beta=true&platforms=cm,spotify&offset=5&limit=25",
    );
    await getResearchSearchHandler(req);

    expect(handleResearch).toHaveBeenCalledWith({
      accountId: "test-id",
      path: "/search",
      query: {
        q: "Hotline Bling",
        type: "tracks",
        limit: "25",
        beta: "true",
        platforms: "cm,spotify",
        offset: "5",
      },
    });
  });

  it("returns suggestions when the beta engine returns a suggestions array", async () => {
    vi.mocked(handleResearch).mockResolvedValue({
      data: { suggestions: [{ name: "Drake", target: "artists", match_strength: 0.99 }] },
    });
    const req = new NextRequest("http://localhost/api/research/search?q=Drake&beta=true");
    const res = await getResearchSearchHandler(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.results[0]).toMatchObject({ name: "Drake", target: "artists" });
  });
});
