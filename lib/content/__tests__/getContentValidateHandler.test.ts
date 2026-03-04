import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getContentValidateHandler } from "@/lib/content/getContentValidateHandler";
import { validateGetContentValidateQuery } from "@/lib/content/validateGetContentValidateQuery";
import { getArtistContentReadiness } from "@/lib/content/getArtistContentReadiness";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/content/validateGetContentValidateQuery", () => ({
  validateGetContentValidateQuery: vi.fn(),
}));

vi.mock("@/lib/content/getArtistContentReadiness", () => ({
  getArtistContentReadiness: vi.fn(),
}));

describe("getContentValidateHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getArtistContentReadiness).mockResolvedValue({
      artist_slug: "gatsby-grace",
      ready: true,
      missing: [],
      warnings: [],
    });
  });

  it("returns validation error when query validation fails", async () => {
    const errorResponse = NextResponse.json(
      { status: "error", error: "artist_slug is required" },
      { status: 400 },
    );
    vi.mocked(validateGetContentValidateQuery).mockResolvedValue(errorResponse);
    const request = new NextRequest("http://localhost/api/content/validate", { method: "GET" });

    const result = await getContentValidateHandler(request);
    expect(result).toBe(errorResponse);
  });

  it("returns readiness payload when validation succeeds", async () => {
    vi.mocked(validateGetContentValidateQuery).mockResolvedValue({
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
    });
    const request = new NextRequest(
      "http://localhost/api/content/validate?artist_slug=gatsby-grace",
      {
        method: "GET",
      },
    );

    const result = await getContentValidateHandler(request);
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.status).toBe("success");
    expect(body.ready).toBe(true);
    expect(body.artist_slug).toBe("gatsby-grace");
    expect(Array.isArray(body.missing)).toBe(true);
  });

  it("returns 500 when readiness check throws", async () => {
    vi.mocked(validateGetContentValidateQuery).mockResolvedValue({
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
    });
    vi.mocked(getArtistContentReadiness).mockRejectedValue(
      new Error("Failed to retrieve repository file tree"),
    );
    const request = new NextRequest(
      "http://localhost/api/content/validate?artist_slug=gatsby-grace",
      {
        method: "GET",
      },
    );

    const result = await getContentValidateHandler(request);
    const body = await result.json();

    expect(result.status).toBe(500);
    expect(body.error).toBe("Failed to retrieve repository file tree");
  });
});
