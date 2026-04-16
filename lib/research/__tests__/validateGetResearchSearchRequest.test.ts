import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetResearchSearchRequest } from "../validateGetResearchSearchRequest";
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

describe("validateGetResearchSearchRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the auth response when auth fails", async () => {
    const authErr = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authErr);
    const req = new NextRequest("http://localhost/api/research/search?q=Drake");
    const res = await validateGetResearchSearchRequest(req);
    expect(res).toBe(authErr);
  });

  it("returns 400 when q is missing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/search");
    const res = await validateGetResearchSearchRequest(req);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.error).toBe("q parameter is required");
  });

  it("fills defaults for type and limit, omits optional params", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/search?q=Drake");
    const res = await validateGetResearchSearchRequest(req);
    expect(res).toEqual({
      accountId: "acc_1",
      q: "Drake",
      type: "artists",
      limit: "10",
      beta: undefined,
      platforms: undefined,
      offset: undefined,
    });
  });

  it("preserves explicit type and limit", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest(
      "http://localhost/api/research/search?q=Drake&type=tracks&limit=25",
    );
    const res = await validateGetResearchSearchRequest(req);
    expect(res).toMatchObject({ type: "tracks", limit: "25" });
  });

  it("passes through beta, platforms, and offset when provided", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest(
      "http://localhost/api/research/search?q=Drake&beta=true&platforms=cm,spotify&offset=5",
    );
    const res = await validateGetResearchSearchRequest(req);
    expect(res).toMatchObject({ beta: "true", platforms: "cm,spotify", offset: "5" });
  });
});
