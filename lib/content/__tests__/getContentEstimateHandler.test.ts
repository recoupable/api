import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getContentEstimateHandler } from "@/lib/content/getContentEstimateHandler";
import { validateGetContentEstimateQuery } from "@/lib/content/validateGetContentEstimateQuery";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/content/validateGetContentEstimateQuery", () => ({
  validateGetContentEstimateQuery: vi.fn(),
}));

describe("getContentEstimateHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validation error when query validation fails", async () => {
    const errorResponse = NextResponse.json(
      { status: "error", error: "invalid query" },
      { status: 400 },
    );
    vi.mocked(validateGetContentEstimateQuery).mockResolvedValue(errorResponse);
    const request = new NextRequest("http://localhost/api/content/estimate", { method: "GET" });

    const result = await getContentEstimateHandler(request);
    expect(result).toBe(errorResponse);
  });

  it("returns estimate payload", async () => {
    vi.mocked(validateGetContentEstimateQuery).mockResolvedValue({
      lipsync: false,
      batch: 2,
      compare: false,
    });
    const request = new NextRequest("http://localhost/api/content/estimate?batch=2", {
      method: "GET",
    });

    const result = await getContentEstimateHandler(request);
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.status).toBe("success");
    expect(body.per_video_estimate_usd).toBe(0.82);
    expect(body.total_estimate_usd).toBe(1.64);
    expect(body.profiles).toBeUndefined();
  });

  it("returns compare profiles when compare=true", async () => {
    vi.mocked(validateGetContentEstimateQuery).mockResolvedValue({
      lipsync: true,
      batch: 1,
      compare: true,
    });
    const request = new NextRequest(
      "http://localhost/api/content/estimate?compare=true&lipsync=true",
      {
        method: "GET",
      },
    );

    const result = await getContentEstimateHandler(request);
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.per_video_estimate_usd).toBe(0.95);
    expect(body.profiles.current).toBe(0.95);
  });
});
