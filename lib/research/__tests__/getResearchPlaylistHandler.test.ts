import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getResearchPlaylistHandler } from "../getResearchPlaylistHandler";
import { validateGetResearchPlaylistRequest } from "../validateGetResearchPlaylistRequest";
import { handleResearch } from "../handleResearch";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetResearchPlaylistRequest", () => ({
  validateGetResearchPlaylistRequest: vi.fn(),
}));

vi.mock("../handleResearch", () => ({
  handleResearch: vi.fn(),
}));

describe("getResearchPlaylistHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateGetResearchPlaylistRequest).mockResolvedValue({
      accountId: "test-id",
      platform: "spotify",
      id: "37i9dQZF1DXcBWIGoYBM5M",
    });
  });

  it("passes through validator error response", async () => {
    const err = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateGetResearchPlaylistRequest).mockResolvedValue(err);
    const req = new NextRequest("http://localhost/api/research/playlist");
    const res = await getResearchPlaylistHandler(req);
    expect(res).toBe(err);
  });

  it("fetches /playlist/:platform/:id and returns 200 with the data", async () => {
    vi.mocked(handleResearch).mockResolvedValueOnce({
      data: { id: "37i9dQZF1DXcBWIGoYBM5M", name: "RapCaviar" },
    });
    const req = new NextRequest(
      "http://localhost/api/research/playlist?platform=spotify&id=37i9dQZF1DXcBWIGoYBM5M",
    );
    const res = await getResearchPlaylistHandler(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.name).toBe("RapCaviar");
    expect(handleResearch).toHaveBeenCalledTimes(1);
    expect(handleResearch).toHaveBeenCalledWith({
      accountId: "test-id",
      path: "/playlist/spotify/37i9dQZF1DXcBWIGoYBM5M",
    });
  });

  it("propagates upstream error status with a 'Playlist lookup failed' message", async () => {
    vi.mocked(handleResearch).mockResolvedValueOnce({
      error: "Request failed with status 404",
      status: 404,
    });
    const req = new NextRequest(
      "http://localhost/api/research/playlist?platform=spotify&id=unknown",
    );
    const res = await getResearchPlaylistHandler(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Playlist lookup failed");
  });

  it("does NOT perform a fallback search when id is non-numeric", async () => {
    vi.mocked(handleResearch).mockResolvedValueOnce({
      data: { id: "abc", name: "Something" },
    });
    const req = new NextRequest("http://localhost/api/research/playlist?platform=spotify&id=abc");
    await getResearchPlaylistHandler(req);

    expect(handleResearch).toHaveBeenCalledTimes(1);
    expect(handleResearch).toHaveBeenCalledWith({
      accountId: "test-id",
      path: "/playlist/spotify/37i9dQZF1DXcBWIGoYBM5M",
    });
  });
});
