import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { getResearchMetricsHandler } from "../getResearchMetricsHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

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

describe("getResearchMetricsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when source is missing", async () => {
    const req = new NextRequest("http://localhost/api/research/metrics?artist=Drake");
    const res = await getResearchMetricsHandler(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when source contains path traversal characters", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-id",
      orgId: null,
      authToken: "token",
    });

    const req = new NextRequest(
      "http://localhost/api/research/metrics?artist=Drake&source=../admin",
    );
    const res = await getResearchMetricsHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid source");
  });

  it("returns 400 when source contains slashes", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-id",
      orgId: null,
      authToken: "token",
    });

    const req = new NextRequest(
      "http://localhost/api/research/metrics?artist=Drake&source=foo/bar",
    );
    const res = await getResearchMetricsHandler(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when source contains encoded slashes", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-id",
      orgId: null,
      authToken: "token",
    });

    const req = new NextRequest(
      "http://localhost/api/research/metrics?artist=Drake&source=foo%2fbar",
    );
    const res = await getResearchMetricsHandler(req);
    expect(res.status).toBe(400);
  });
});
