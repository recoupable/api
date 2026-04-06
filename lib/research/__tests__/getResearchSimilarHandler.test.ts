import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { getResearchSimilarHandler } from "../getResearchSimilarHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { resolveArtist } from "@/lib/research/resolveArtist";
import { proxyToChartmetric } from "@/lib/research/proxyToChartmetric";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/research/resolveArtist", () => ({
  resolveArtist: vi.fn(),
}));

vi.mock("@/lib/research/proxyToChartmetric", () => ({
  proxyToChartmetric: vi.fn(),
}));

vi.mock("@/lib/credits/deductCredits", () => ({
  deductCredits: vi.fn(),
}));

describe("getResearchSimilarHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-id",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(resolveArtist).mockResolvedValue({ id: 3380 });
  });

  it("uses by-configurations path with default params when no config params provided", async () => {
    vi.mocked(proxyToChartmetric).mockResolvedValue({
      data: [{ id: 100, name: "Kendrick Lamar" }],
      status: 200,
    });

    const req = new NextRequest("http://localhost/api/research/similar?artist=Drake");
    const res = await getResearchSimilarHandler(req);
    expect(res.status).toBe(200);

    // Should call by-configurations, NOT relatedartists
    const calledPath = vi.mocked(proxyToChartmetric).mock.calls[0][0];
    expect(calledPath).toContain("by-configurations");
    expect(calledPath).not.toContain("relatedartists");
  });

  it("uses by-configurations path when config params are provided", async () => {
    vi.mocked(proxyToChartmetric).mockResolvedValue({
      data: [{ id: 100, name: "Kendrick Lamar" }],
      status: 200,
    });

    const req = new NextRequest("http://localhost/api/research/similar?artist=Drake&genre=high");
    const res = await getResearchSimilarHandler(req);
    expect(res.status).toBe(200);

    const calledPath = vi.mocked(proxyToChartmetric).mock.calls[0][0];
    expect(calledPath).toContain("by-configurations");
  });

  it("passes default medium values for config params when none provided", async () => {
    vi.mocked(proxyToChartmetric).mockResolvedValue({
      data: [],
      status: 200,
    });

    const req = new NextRequest("http://localhost/api/research/similar?artist=Drake");
    await getResearchSimilarHandler(req);

    const calledParams = vi.mocked(proxyToChartmetric).mock.calls[0][1];
    expect(calledParams).toMatchObject({
      audience: "medium",
      genre: "medium",
      mood: "medium",
      musicality: "medium",
    });
  });
});
