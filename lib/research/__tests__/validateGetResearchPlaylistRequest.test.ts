import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetResearchPlaylistRequest } from "../validateGetResearchPlaylistRequest";
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

describe("validateGetResearchPlaylistRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the auth response when auth fails", async () => {
    const authErr = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authErr);
    const req = new NextRequest("http://localhost/api/research/playlist?platform=spotify&id=1");
    const res = await validateGetResearchPlaylistRequest(req);
    expect(res).toBe(authErr);
  });

  it("returns 400 when platform is missing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/playlist?id=1");
    const res = await validateGetResearchPlaylistRequest(req);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.error).toContain("platform and id");
  });

  it("returns 400 when id is missing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/playlist?platform=spotify");
    const res = await validateGetResearchPlaylistRequest(req);
    expect((res as NextResponse).status).toBe(400);
  });

  it("returns 400 for invalid platform", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/playlist?platform=bogus&id=1");
    const res = await validateGetResearchPlaylistRequest(req);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.error).toContain("Invalid platform");
  });

  it("returns validated request on success", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest(
      "http://localhost/api/research/playlist?platform=spotify&id=37i9dQZF1DXcBWIGoYBM5M",
    );
    const res = await validateGetResearchPlaylistRequest(req);
    expect(res).toEqual({
      accountId: "acc_1",
      platform: "spotify",
      id: "37i9dQZF1DXcBWIGoYBM5M",
    });
  });
});
