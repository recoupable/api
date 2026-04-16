import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getResearchAlbumsHandler } from "../getResearchAlbumsHandler";
import { validateGetResearchAlbumsRequest } from "../validateGetResearchAlbumsRequest";
import { handleResearch } from "../handleResearch";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetResearchAlbumsRequest", () => ({
  validateGetResearchAlbumsRequest: vi.fn(),
}));

vi.mock("../handleResearch", () => ({
  handleResearch: vi.fn(),
}));

describe("getResearchAlbumsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateGetResearchAlbumsRequest).mockResolvedValue({
      accountId: "test-id",
      artistId: "3380",
    });
  });

  it("passes through validator error response", async () => {
    const err = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateGetResearchAlbumsRequest).mockResolvedValue(err);
    const req = new NextRequest("http://localhost/api/research/albums");
    const res = await getResearchAlbumsHandler(req);
    expect(res).toBe(err);
  });

  it("fetches /artist/:id/albums and returns 200 with albums array", async () => {
    vi.mocked(handleResearch).mockResolvedValueOnce({
      data: [
        { id: 1, name: "Scorpion" },
        { id: 2, name: "Views" },
      ],
    });
    const req = new NextRequest("http://localhost/api/research/albums?artist_id=3380");
    const res = await getResearchAlbumsHandler(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.albums).toEqual([
      { id: 1, name: "Scorpion" },
      { id: 2, name: "Views" },
    ]);
    expect(handleResearch).toHaveBeenCalledWith({
      accountId: "test-id",
      path: "/artist/3380/albums",
    });
  });

  it("returns an empty albums array when upstream returns a non-array", async () => {
    vi.mocked(handleResearch).mockResolvedValueOnce({ data: null });
    const req = new NextRequest("http://localhost/api/research/albums?artist_id=3380");
    const res = await getResearchAlbumsHandler(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.albums).toEqual([]);
  });

  it("propagates upstream error status", async () => {
    vi.mocked(handleResearch).mockResolvedValueOnce({
      error: "Request failed with status 404",
      status: 404,
    });
    const req = new NextRequest("http://localhost/api/research/albums?artist_id=999");
    const res = await getResearchAlbumsHandler(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Failed to fetch artist albums");
  });
});
