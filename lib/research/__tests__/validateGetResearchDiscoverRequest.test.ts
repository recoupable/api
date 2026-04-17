import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetResearchDiscoverRequest } from "../validateGetResearchDiscoverRequest";
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

describe("validateGetResearchDiscoverRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the auth response when auth fails", async () => {
    const authErr = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authErr);

    const req = new NextRequest("http://localhost/api/research/discover");
    const res = await validateGetResearchDiscoverRequest(req);
    expect(res).toBe(authErr);
  });

  it("returns 400 when country is not 2 letters", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/discover?country=USA");
    const res = await validateGetResearchDiscoverRequest(req);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.error).toContain("2-letter");
  });

  it("returns 400 when limit exceeds max", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/discover?limit=500");
    const res = await validateGetResearchDiscoverRequest(req);
    expect((res as NextResponse).status).toBe(400);
  });

  it("returns parsed values plus accountId on success", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest(
      "http://localhost/api/research/discover?country=US&genre=rock&limit=10&sp_monthly_listeners_min=100&sp_monthly_listeners_max=500",
    );
    const res = await validateGetResearchDiscoverRequest(req);
    expect(res).toEqual({
      accountId: "acc_1",
      country: "US",
      genre: "rock",
      limit: 10,
      sp_monthly_listeners_min: 100,
      sp_monthly_listeners_max: 500,
    });
  });

  it("returns just accountId when no params are provided", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/discover");
    const res = await validateGetResearchDiscoverRequest(req);
    expect(res).toEqual({ accountId: "acc_1" });
  });
});
