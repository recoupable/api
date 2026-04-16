import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetResearchLookupRequest } from "../validateGetResearchLookupRequest";
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

describe("validateGetResearchLookupRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the auth response when auth fails", async () => {
    const authErr = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authErr);

    const req = new NextRequest(
      "http://localhost/api/research/lookup?url=https://open.spotify.com/artist/abc",
    );
    const res = await validateGetResearchLookupRequest(req);
    expect(res).toBe(authErr);
  });

  it("returns 400 when url is missing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/lookup");
    const res = await validateGetResearchLookupRequest(req);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.error).toBe("url parameter is required");
  });

  it("returns 400 when url is not a Spotify artist URL", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/lookup?url=https://google.com");
    const res = await validateGetResearchLookupRequest(req);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.error).toContain("Spotify artist URL");
  });

  it("extracts spotifyId from a valid URL", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest(
      "http://localhost/api/research/lookup?url=https://open.spotify.com/artist/3TVXtAsR1Inumwj472S9r4",
    );
    const res = await validateGetResearchLookupRequest(req);
    expect(res).toEqual({ accountId: "acc_1", spotifyId: "3TVXtAsR1Inumwj472S9r4" });
  });
});
