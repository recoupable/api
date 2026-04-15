import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { getResearchChartsHandler } from "../getResearchChartsHandler";
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

describe("getResearchChartsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-id",
      orgId: null,
      authToken: "token",
    });
  });

  it("returns 400 when platform is missing", async () => {
    const req = new NextRequest("http://localhost/api/research/charts");
    const res = await getResearchChartsHandler(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when platform contains path traversal", async () => {
    const req = new NextRequest("http://localhost/api/research/charts?platform=../admin");
    const res = await getResearchChartsHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid platform");
  });

  it("returns 400 when platform contains slashes", async () => {
    const req = new NextRequest("http://localhost/api/research/charts?platform=foo/bar");
    const res = await getResearchChartsHandler(req);
    expect(res.status).toBe(400);
  });

  it("defaults type to 'regional' and interval to 'daily'", async () => {
    vi.mocked(fetchChartmetric).mockResolvedValue({
      data: { chart: [] },
      status: 200,
    });

    const req = new NextRequest("http://localhost/api/research/charts?platform=spotify&country=US");
    await getResearchChartsHandler(req);

    const calledParams = vi.mocked(fetchChartmetric).mock.calls[0][1];
    expect(calledParams).toHaveProperty("type", "regional");
    expect(calledParams).toHaveProperty("interval", "daily");
    expect(calledParams).toHaveProperty("country_code", "US");
  });

  it("preserves user-provided type and interval", async () => {
    vi.mocked(fetchChartmetric).mockResolvedValue({
      data: { chart: [] },
      status: 200,
    });

    const req = new NextRequest(
      "http://localhost/api/research/charts?platform=spotify&type=viral&interval=weekly&country=US",
    );
    await getResearchChartsHandler(req);

    const calledParams = vi.mocked(fetchChartmetric).mock.calls[0][1];
    expect(calledParams).toMatchObject({ type: "viral", interval: "weekly" });
  });
});
