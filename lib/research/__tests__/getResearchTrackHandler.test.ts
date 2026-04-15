import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getResearchTrackHandler } from "../getResearchTrackHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { fetchChartmetric } from "@/lib/research/fetchChartmetric";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/research/fetchChartmetric", () => ({
  fetchChartmetric: vi.fn(),
}));

vi.mock("@/lib/credits/deductCredits", () => ({
  deductCredits: vi.fn(),
}));

describe("getResearchTrackHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth fails", async () => {
    const errorResponse = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(errorResponse);

    const req = new NextRequest("http://localhost/api/research/track?q=Hotline+Bling");
    const res = await getResearchTrackHandler(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when q param is missing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-id",
      orgId: null,
      authToken: "token",
    });

    const req = new NextRequest("http://localhost/api/research/track");
    const res = await getResearchTrackHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("q parameter is required");
  });

  it("returns 200 with track data on success", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-id",
      orgId: null,
      authToken: "token",
    });

    vi.mocked(fetchChartmetric)
      .mockResolvedValueOnce({
        data: { tracks: [{ id: 12345 }] },
        status: 200,
      })
      .mockResolvedValueOnce({
        data: { name: "Hotline Bling", artist: "Drake", id: 12345 },
        status: 200,
      });

    const req = new NextRequest("http://localhost/api/research/track?q=Hotline+Bling");
    const res = await getResearchTrackHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.name).toBe("Hotline Bling");
  });
});
