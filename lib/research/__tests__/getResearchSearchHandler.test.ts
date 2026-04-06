import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getResearchSearchHandler } from "../getResearchSearchHandler";
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

describe("getResearchSearchHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth fails", async () => {
    const errorResponse = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(errorResponse);

    const req = new NextRequest("http://localhost/api/research?q=Drake");
    const res = await getResearchSearchHandler(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when q param is missing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-id",
      orgId: null,
      authToken: "token",
    });

    const req = new NextRequest("http://localhost/api/research");
    const res = await getResearchSearchHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("q parameter is required");
  });

  it("returns 200 with results on success", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-id",
      orgId: null,
      authToken: "token",
    });

    vi.mocked(proxyToChartmetric).mockResolvedValue({
      data: { artists: [{ name: "Drake", id: 3380 }] },
      status: 200,
    });

    const req = new NextRequest("http://localhost/api/research?q=Drake");
    const res = await getResearchSearchHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.results).toEqual([{ name: "Drake", id: 3380 }]);
  });
});
