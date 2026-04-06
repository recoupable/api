import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getResearchDiscoverHandler } from "../getResearchDiscoverHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { proxyToChartmetric } from "@/lib/research/proxyToChartmetric";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/research/proxyToChartmetric", () => ({
  proxyToChartmetric: vi.fn(),
}));

vi.mock("@/lib/credits/deductCredits", () => ({
  deductCredits: vi.fn(),
}));

describe("getResearchDiscoverHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth fails", async () => {
    const errorResponse = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(errorResponse);

    const req = new NextRequest("http://localhost/api/research/discover?country=US");
    const res = await getResearchDiscoverHandler(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when country is not 2 letters", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-id",
      orgId: null,
      authToken: "tok",
    } as ReturnType<typeof validateAuthContext> extends Promise<infer T>
      ? Exclude<T, NextResponse>
      : never);

    const req = new NextRequest("http://localhost/api/research/discover?country=USA");
    const res = await getResearchDiscoverHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.status).toBe("error");
    expect(body.error).toContain("2-letter");
  });

  it("returns 400 when limit is negative", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-id",
      orgId: null,
      authToken: "tok",
    } as ReturnType<typeof validateAuthContext> extends Promise<infer T>
      ? Exclude<T, NextResponse>
      : never);

    const req = new NextRequest("http://localhost/api/research/discover?limit=-5");
    const res = await getResearchDiscoverHandler(req);
    expect(res.status).toBe(400);
  });

  it("returns artists on success", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-id",
      orgId: null,
      authToken: "tok",
    } as ReturnType<typeof validateAuthContext> extends Promise<infer T>
      ? Exclude<T, NextResponse>
      : never);

    vi.mocked(proxyToChartmetric).mockResolvedValue({
      data: [
        { name: "Artist A", sp_monthly_listeners: 100000 },
        { name: "Artist B", sp_monthly_listeners: 200000 },
      ],
      status: 200,
    });

    const req = new NextRequest("http://localhost/api/research/discover?country=US&limit=10");
    const res = await getResearchDiscoverHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.artists).toHaveLength(2);
    expect(body.artists[0].name).toBe("Artist A");
  });

  it("passes sp_ml range when both min and max provided", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-id",
      orgId: null,
      authToken: "tok",
    } as ReturnType<typeof validateAuthContext> extends Promise<infer T>
      ? Exclude<T, NextResponse>
      : never);

    vi.mocked(proxyToChartmetric).mockResolvedValue({
      data: [],
      status: 200,
    });

    const req = new NextRequest(
      "http://localhost/api/research/discover?sp_monthly_listeners_min=50000&sp_monthly_listeners_max=200000",
    );
    await getResearchDiscoverHandler(req);

    expect(proxyToChartmetric).toHaveBeenCalledWith(
      "/artist/list/filter",
      expect.objectContaining({ "sp_ml[]": "50000,200000" }),
    );
  });

  it("returns empty array when proxy fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-id",
      orgId: null,
      authToken: "tok",
    } as ReturnType<typeof validateAuthContext> extends Promise<infer T>
      ? Exclude<T, NextResponse>
      : never);

    vi.mocked(proxyToChartmetric).mockResolvedValue({
      data: null,
      status: 500,
    });

    const req = new NextRequest("http://localhost/api/research/discover?country=US");
    const res = await getResearchDiscoverHandler(req);
    expect(res.status).toBe(500);
  });
});
