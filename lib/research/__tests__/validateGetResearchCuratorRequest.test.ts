import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetResearchCuratorRequest } from "../validateGetResearchCuratorRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

describe("validateGetResearchCuratorRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc-1",
      orgId: null,
      authToken: "t",
    });
  });

  it("returns auth error when auth fails", async () => {
    const errResp = NextResponse.json({ error: "no" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(errResp);
    const result = await validateGetResearchCuratorRequest(
      new NextRequest("http://localhost/api/research/curator?platform=spotify&id=2"),
    );
    expect(result).toBe(errResp);
  });

  it("returns 400 when platform is missing", async () => {
    const result = await validateGetResearchCuratorRequest(
      new NextRequest("http://localhost/api/research/curator?id=2"),
    );
    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.error).toBe("platform parameter is required");
    }
  });

  it("returns 400 when id is missing", async () => {
    const result = await validateGetResearchCuratorRequest(
      new NextRequest("http://localhost/api/research/curator?platform=spotify"),
    );
    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.error).toBe("id parameter is required");
    }
  });

  it("returns 400 when platform is not spotify/applemusic/deezer", async () => {
    const result = await validateGetResearchCuratorRequest(
      new NextRequest("http://localhost/api/research/curator?platform=youtube&id=2"),
    );
    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.error).toBe("Invalid platform. Must be one of: spotify, applemusic, deezer");
    }
  });

  it("returns 400 when id is non-numeric", async () => {
    const result = await validateGetResearchCuratorRequest(
      new NextRequest("http://localhost/api/research/curator?platform=spotify&id=spotify"),
    );
    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.error).toBe("id must be a numeric Chartmetric curator ID (e.g. 2 for Spotify)");
    }
  });

  it("returns accountId, platform, id on success", async () => {
    const result = await validateGetResearchCuratorRequest(
      new NextRequest("http://localhost/api/research/curator?platform=spotify&id=2"),
    );
    expect(result).toEqual({ accountId: "acc-1", platform: "spotify", id: "2" });
  });

  it("accepts applemusic and deezer as valid platforms", async () => {
    for (const platform of ["applemusic", "deezer"] as const) {
      const result = await validateGetResearchCuratorRequest(
        new NextRequest(`http://localhost/api/research/curator?platform=${platform}&id=1000`),
      );
      expect(result).toEqual({ accountId: "acc-1", platform, id: "1000" });
    }
  });
});
