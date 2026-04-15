import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getResearchTrackPlaylistsHandler } from "../getResearchTrackPlaylistsHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { fetchChartmetric } from "@/lib/research/fetchChartmetric";
import { resolveTrack } from "@/lib/research/resolveTrack";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/research/fetchChartmetric", () => ({
  fetchChartmetric: vi.fn(),
}));

vi.mock("@/lib/research/resolveTrack", () => ({
  resolveTrack: vi.fn(),
}));

vi.mock("@/lib/credits/deductCredits", () => ({
  deductCredits: vi.fn(),
}));

describe("getResearchTrackPlaylistsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth fails", async () => {
    const errorResponse = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(errorResponse);

    const req = new NextRequest("http://localhost/api/research/track/playlists?id=18220712");
    const res = await getResearchTrackPlaylistsHandler(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when both id and q are missing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-id",
      orgId: null,
      authToken: "token",
    });

    const req = new NextRequest("http://localhost/api/research/track/playlists");
    const res = await getResearchTrackPlaylistsHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("id or q parameter is required");
  });

  it("returns 400 for invalid platform", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-id",
      orgId: null,
      authToken: "token",
    });

    const req = new NextRequest(
      "http://localhost/api/research/track/playlists?id=123&platform=invalid",
    );
    const res = await getResearchTrackPlaylistsHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid platform");
  });

  it("returns 400 for invalid status", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-id",
      orgId: null,
      authToken: "token",
    });

    const req = new NextRequest(
      "http://localhost/api/research/track/playlists?id=123&status=invalid",
    );
    const res = await getResearchTrackPlaylistsHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("status must be");
  });

  it("returns 200 with playlists when given a track id", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-id",
      orgId: null,
      authToken: "token",
    });

    vi.mocked(fetchChartmetric).mockResolvedValue({
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
      status: 200,
    });

    const req = new NextRequest(
      "http://localhost/api/research/track/playlists?id=18220712&editorial=true",
    );
    const res = await getResearchTrackPlaylistsHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.placements).toHaveLength(1);
    expect(body.placements[0].playlist.name).toBe("Chill Vibes");
  });

  it("resolves track by name when q is provided", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-id",
      orgId: null,
      authToken: "token",
    });

    vi.mocked(resolveTrack).mockResolvedValue({ id: "18220712" });

    vi.mocked(fetchChartmetric).mockResolvedValue({
      data: [
        {
          playlist: { name: "Today's Top Hits", image_url: "https://i.scdn.co/image/xyz" },
          track: { name: "God's Plan" },
        },
      ],
      status: 200,
    });

    const req = new NextRequest(
      "http://localhost/api/research/track/playlists?q=God%27s+Plan&artist=Drake",
    );
    const res = await getResearchTrackPlaylistsHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.placements).toHaveLength(1);
    expect(vi.mocked(resolveTrack)).toHaveBeenCalledWith("God's Plan", "Drake");
  });

  it("returns 404 when track name search finds nothing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-id",
      orgId: null,
      authToken: "token",
    });

    vi.mocked(resolveTrack).mockResolvedValue({
      error: 'No track found matching "nonexistent song"',
    });

    const req = new NextRequest("http://localhost/api/research/track/playlists?q=nonexistent+song");
    const res = await getResearchTrackPlaylistsHandler(req);
    expect(res.status).toBe(404);
  });

  it("returns empty placements when Chartmetric returns non-array", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-id",
      orgId: null,
      authToken: "token",
    });

    vi.mocked(fetchChartmetric).mockResolvedValue({
      data: null,
      status: 200,
    });

    const req = new NextRequest("http://localhost/api/research/track/playlists?id=123");
    const res = await getResearchTrackPlaylistsHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.placements).toEqual([]);
  });
});
