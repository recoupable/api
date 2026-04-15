import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getResearchTrackPlaylistsHandler } from "../getResearchTrackPlaylistsHandler";
import { validateGetResearchTrackPlaylistsRequest } from "../validateGetResearchTrackPlaylistsRequest";
import { handleResearch } from "../handleResearch";
import { resolveTrack } from "../resolveTrack";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetResearchTrackPlaylistsRequest", () => ({
  validateGetResearchTrackPlaylistsRequest: vi.fn(),
}));

vi.mock("../handleResearch", () => ({
  handleResearch: vi.fn(),
}));

vi.mock("../resolveTrack", () => ({
  resolveTrack: vi.fn(),
}));

const baseValidated = {
  accountId: "test-id",
  id: "18220712" as string | null,
  q: null as string | null,
  artist: undefined as string | undefined,
  platform: "spotify",
  status: "current",
  filters: { editorial: "true" },
  pagination: {},
};

describe("getResearchTrackPlaylistsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateGetResearchTrackPlaylistsRequest).mockResolvedValue({ ...baseValidated });
  });

  it("passes through validator error response", async () => {
    const err = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateGetResearchTrackPlaylistsRequest).mockResolvedValue(err);
    const req = new NextRequest("http://localhost/api/research/track/playlists");
    const res = await getResearchTrackPlaylistsHandler(req);
    expect(res).toBe(err);
  });

  it("returns 200 with placements when given a track id", async () => {
    vi.mocked(handleResearch).mockResolvedValue({
      data: [
        {
          playlist: {
            name: "Chill Vibes",
            image_url: "https://i.scdn.co/image/abc",
            editorial: true,
          },
          track: { name: "God's Plan", cm_track: 18220712 },
        },
      ],
    });
    const req = new NextRequest("http://localhost/api/research/track/playlists?id=18220712");
    const res = await getResearchTrackPlaylistsHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.placements).toHaveLength(1);
    expect(body.placements[0].playlist.name).toBe("Chill Vibes");
  });

  it("resolves track by name when q is provided", async () => {
    vi.mocked(validateGetResearchTrackPlaylistsRequest).mockResolvedValue({
      ...baseValidated,
      id: null,
      q: "God's Plan",
      artist: "Drake",
    });
    vi.mocked(resolveTrack).mockResolvedValue({ id: "18220712" });
    vi.mocked(handleResearch).mockResolvedValue({
      data: [{ playlist: { name: "Today's Top Hits" }, track: { name: "God's Plan" } }],
    });

    const req = new NextRequest(
      "http://localhost/api/research/track/playlists?q=God%27s+Plan&artist=Drake",
    );
    const res = await getResearchTrackPlaylistsHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.placements).toHaveLength(1);
    expect(vi.mocked(resolveTrack)).toHaveBeenCalledWith("God's Plan", "Drake");
  });

  it("returns 404 when track name search finds nothing", async () => {
    vi.mocked(validateGetResearchTrackPlaylistsRequest).mockResolvedValue({
      ...baseValidated,
      id: null,
      q: "nonexistent",
    });
    vi.mocked(resolveTrack).mockResolvedValue({
      error: 'No track found matching "nonexistent"',
    });
    const req = new NextRequest("http://localhost/api/research/track/playlists?q=nonexistent");
    const res = await getResearchTrackPlaylistsHandler(req);
    expect(res.status).toBe(404);
  });

  it("returns empty placements when Chartmetric returns non-array", async () => {
    vi.mocked(handleResearch).mockResolvedValue({ data: null });
    const req = new NextRequest("http://localhost/api/research/track/playlists?id=123");
    const res = await getResearchTrackPlaylistsHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.placements).toEqual([]);
  });

  it("propagates upstream error status", async () => {
    vi.mocked(handleResearch).mockResolvedValue({
      error: "Request failed with status 502",
      status: 502,
    });
    const req = new NextRequest("http://localhost/api/research/track/playlists?id=123");
    const res = await getResearchTrackPlaylistsHandler(req);
    expect(res.status).toBe(502);
  });
});
