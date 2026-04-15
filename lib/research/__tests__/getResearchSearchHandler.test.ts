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
});
