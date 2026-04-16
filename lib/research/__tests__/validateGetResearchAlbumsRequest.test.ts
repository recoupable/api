import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetResearchAlbumsRequest } from "../validateGetResearchAlbumsRequest";
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

describe("validateGetResearchAlbumsRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the auth response when auth fails", async () => {
    const authErr = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authErr);
    const req = new NextRequest("http://localhost/api/research/albums?artist_id=3380");
    const res = await validateGetResearchAlbumsRequest(req);
    expect(res).toBe(authErr);
  });

  it("returns 400 when artist_id is missing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/albums");
    const res = await validateGetResearchAlbumsRequest(req);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.error).toBe("artist_id parameter is required");
  });

  it("returns 400 when artist_id is not a positive integer", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/albums?artist_id=Drake");
    const res = await validateGetResearchAlbumsRequest(req);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.error).toBe("artist_id must be a positive integer");
  });

  it("defaults to is_primary=true and omits pagination when not supplied", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/albums?artist_id=3380");
    const res = await validateGetResearchAlbumsRequest(req);
    expect(res).toEqual({
      accountId: "acc_1",
      artistId: "3380",
      isPrimary: "true",
      limit: undefined,
      offset: undefined,
    });
  });

  it("accepts is_primary=false to include features/compilations", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest(
      "http://localhost/api/research/albums?artist_id=3380&is_primary=false",
    );
    const res = await validateGetResearchAlbumsRequest(req);
    expect(res).toMatchObject({ isPrimary: "false" });
  });

  it("returns 400 when is_primary isn't true or false", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest(
      "http://localhost/api/research/albums?artist_id=3380&is_primary=yes",
    );
    const res = await validateGetResearchAlbumsRequest(req);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.error).toContain("is_primary must be");
  });

  it("passes through limit and offset when provided", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest(
      "http://localhost/api/research/albums?artist_id=3380&limit=25&offset=50",
    );
    const res = await validateGetResearchAlbumsRequest(req);
    expect(res).toMatchObject({ limit: "25", offset: "50" });
  });

  it("returns 400 when limit is not a positive integer", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/albums?artist_id=3380&limit=abc");
    const res = await validateGetResearchAlbumsRequest(req);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.error).toContain("limit must be a positive integer");
  });

  it("returns 400 when offset is negative", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/albums?artist_id=3380&offset=-1");
    const res = await validateGetResearchAlbumsRequest(req);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.error).toContain("offset must be a non-negative integer");
  });
});
