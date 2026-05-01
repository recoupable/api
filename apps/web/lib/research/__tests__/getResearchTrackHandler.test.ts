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
      id: "15194376",
    });
  });

  it("passes through validator error response", async () => {
    const err = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateGetResearchTrackRequest).mockResolvedValue(err);
    const req = new NextRequest("http://localhost/api/research/track");
    const res = await getResearchTrackHandler(req);
    expect(res).toBe(err);
  });

  it("fetches /track/:id from Chartmetric and returns 200 with the data", async () => {
    vi.mocked(handleResearch).mockResolvedValueOnce({
      data: { id: 15194376, name: "Hotline Bling", artists: [{ id: 1, name: "Drake" }] },
    });
    const req = new NextRequest("http://localhost/api/research/track?id=15194376");
    const res = await getResearchTrackHandler(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.name).toBe("Hotline Bling");
    expect(body.id).toBe(15194376);
    expect(handleResearch).toHaveBeenCalledTimes(1);
    expect(handleResearch).toHaveBeenCalledWith({
      accountId: "test-id",
      path: "/track/15194376",
    });
  });

  it("propagates upstream error status and message", async () => {
    vi.mocked(handleResearch).mockResolvedValueOnce({
      error: "Request failed with status 404",
      status: 404,
    });
    const req = new NextRequest("http://localhost/api/research/track?id=999");
    const res = await getResearchTrackHandler(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Failed to fetch track details");
  });
});
