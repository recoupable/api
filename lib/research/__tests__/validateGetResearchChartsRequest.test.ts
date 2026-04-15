import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetResearchChartsRequest } from "../validateGetResearchChartsRequest";
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

describe("validateGetResearchChartsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the auth response when auth fails", async () => {
    const authErr = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authErr);

    const req = new NextRequest("http://localhost/api/research/charts?platform=spotify");
    const res = await validateGetResearchChartsRequest(req);
    expect(res).toBe(authErr);
  });

  it("returns 400 when platform is missing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/charts");
    const res = await validateGetResearchChartsRequest(req);
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.error).toBe("platform parameter is required");
  });

  it("returns 400 when platform is not lowercase alpha", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/charts?platform=Spotify/x");
    const res = await validateGetResearchChartsRequest(req);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.error).toContain("Invalid platform");
  });

  it("fills in defaults when optional params are omitted", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/charts?platform=spotify");
    const res = await validateGetResearchChartsRequest(req);
    expect(res).toEqual({
      accountId: "acc_1",
      platform: "spotify",
      country: "US",
      interval: "daily",
      type: "regional",
      latest: "true",
    });
  });

  it("preserves explicit params over defaults", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest(
      "http://localhost/api/research/charts?platform=spotify&country=GB&interval=weekly&type=viral&latest=false",
    );
    const res = await validateGetResearchChartsRequest(req);
    expect(res).toMatchObject({
      country: "GB",
      interval: "weekly",
      type: "viral",
      latest: "false",
    });
  });
});
