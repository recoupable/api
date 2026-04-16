import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetResearchTrackRequest } from "../validateGetResearchTrackRequest";
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

describe("validateGetResearchTrackRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the auth response when auth fails", async () => {
    const authErr = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authErr);
    const req = new NextRequest("http://localhost/api/research/track?q=foo");
    const res = await validateGetResearchTrackRequest(req);
    expect(res).toBe(authErr);
  });

  it("returns 400 when q is missing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/track");
    const res = await validateGetResearchTrackRequest(req);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.error).toBe("q parameter is required");
  });

  it("returns the validated request", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/track?q=Hotline+Bling");
    const res = await validateGetResearchTrackRequest(req);
    expect(res).toEqual({ accountId: "acc_1", q: "Hotline Bling", artist: undefined });
  });

  it("passes through an optional artist query param", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/track?q=Hotline+Bling&artist=Drake");
    const res = await validateGetResearchTrackRequest(req);
    expect(res).toEqual({ accountId: "acc_1", q: "Hotline Bling", artist: "Drake" });
  });

  it("returns undefined artist when the query param is missing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/track?q=Flowers");
    const res = await validateGetResearchTrackRequest(req);
    expect((res as { artist?: string }).artist).toBeUndefined();
  });
});
