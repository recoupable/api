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

  it("returns 400 for an unknown type (not regional or viral)", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/charts?platform=spotify&type=top");
    const res = await validateGetResearchChartsRequest(req);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.error).toContain("type must be one of");
    expect(body.error).toContain("regional");
    expect(body.error).toContain("viral");
  });

  it("returns 400 for an unknown interval (not daily or weekly)", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest(
      "http://localhost/api/research/charts?platform=spotify&interval=monthly",
    );
    const res = await validateGetResearchChartsRequest(req);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.error).toContain("interval must be one of");
  });

  it("returns 400 for a latest value that isn't a boolean string", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/charts?platform=spotify&latest=yes");
    const res = await validateGetResearchChartsRequest(req);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.error).toContain("latest must be");
  });
});
