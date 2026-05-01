import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetResearchTrackPlaylistsRequest } from "../validateGetResearchTrackPlaylistsRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

const okAuth = {
  accountId: "acc_1",
  orgId: null,
  authToken: "tok",
} as ReturnType<typeof validateAuthContext> extends Promise<infer T>
  ? Exclude<T, NextResponse>
  : never;

describe("validateGetResearchTrackPlaylistsRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the auth response when auth fails", async () => {
    const authErr = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authErr);
    const req = new NextRequest("http://localhost/api/research/track/playlists?id=1");
    const res = await validateGetResearchTrackPlaylistsRequest(req);
    expect(res).toBe(authErr);
  });

  it("returns 400 when both id and q are missing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/track/playlists");
    const res = await validateGetResearchTrackPlaylistsRequest(req);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.error).toContain("id or q parameter is required");
  });

  it("returns 400 for invalid platform", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest(
      "http://localhost/api/research/track/playlists?id=1&platform=bogus",
    );
    const res = await validateGetResearchTrackPlaylistsRequest(req);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.error).toContain("Invalid platform");
  });

  it("returns 400 for invalid status", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/track/playlists?id=1&status=bogus");
    const res = await validateGetResearchTrackPlaylistsRequest(req);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.error).toContain("status must be");
  });

  it("applies default filters when none supplied", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/track/playlists?id=1");
    const res = await validateGetResearchTrackPlaylistsRequest(req);
    expect(res).not.toBeInstanceOf(NextResponse);
    const v = res as Exclude<typeof res, NextResponse>;
    expect(v.filters).toEqual({
      editorial: "true",
      indie: "true",
      majorCurator: "true",
      popularIndie: "true",
    });
    expect(v.platform).toBe("spotify");
    expect(v.status).toBe("current");
  });

  it("preserves user-supplied filters + pagination", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest(
      "http://localhost/api/research/track/playlists?id=1&editorial=false&chart=true&limit=20&offset=10&sort=date",
    );
    const res = await validateGetResearchTrackPlaylistsRequest(req);
    const v = res as Exclude<typeof res, NextResponse>;
    expect(v.filters).toEqual({ editorial: "false", chart: "true" });
    expect(v.pagination).toEqual({ limit: "20", offset: "10", sortColumn: "date" });
  });

  it("accepts q + artist without id", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest(
      "http://localhost/api/research/track/playlists?q=God%27s+Plan&artist=Drake",
    );
    const res = await validateGetResearchTrackPlaylistsRequest(req);
    const v = res as Exclude<typeof res, NextResponse>;
    expect(v.q).toBe("God's Plan");
    expect(v.artist).toBe("Drake");
    expect(v.id).toBeNull();
  });
});
