import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createContentHandler } from "@/lib/content/createContentHandler";
import { validateCreateContentBody } from "@/lib/content/validateCreateContentBody";
import { triggerCreateContent } from "@/lib/trigger/triggerCreateContent";
import { getArtistContentReadiness } from "@/lib/content/getArtistContentReadiness";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/content/validateCreateContentBody", () => ({
  validateCreateContentBody: vi.fn(),
}));

vi.mock("@/lib/trigger/triggerCreateContent", () => ({
  triggerCreateContent: vi.fn(),
}));

vi.mock("@/lib/content/getArtistContentReadiness", () => ({
  getArtistContentReadiness: vi.fn(),
}));

describe("createContentHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getArtistContentReadiness).mockResolvedValue({
      artist_slug: "gatsby-grace",
      ready: true,
      missing: [],
      warnings: [],
      githubRepo: "https://github.com/test/repo",
    });
  });

  it("returns validation/auth error when validation fails", async () => {
    const errorResponse = NextResponse.json(
      { status: "error", error: "Unauthorized" },
      { status: 401 },
    );
    vi.mocked(validateCreateContentBody).mockResolvedValue(errorResponse);
    const request = new NextRequest("http://localhost/api/content/create", { method: "POST" });

    const result = await createContentHandler(request);

    expect(result).toBe(errorResponse);
  });

  it("returns 202 with runId when trigger succeeds", async () => {
    vi.mocked(validateCreateContentBody).mockResolvedValue({
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
      template: "artist-caption-bedroom",
      lipsync: false,
      captionLength: "short",
      upscale: false,
    });
    vi.mocked(triggerCreateContent).mockResolvedValue({ id: "run_abc123" } as never);
    const request = new NextRequest("http://localhost/api/content/create", { method: "POST" });

    const result = await createContentHandler(request);
    const body = await result.json();

    expect(result.status).toBe(202);
    expect(body).toEqual({
      runId: "run_abc123",
      status: "triggered",
      artist: "gatsby-grace",
      template: "artist-caption-bedroom",
      lipsync: false,
    });
  });

  it("returns 500 when trigger fails", async () => {
    vi.mocked(validateCreateContentBody).mockResolvedValue({
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
      template: "artist-caption-bedroom",
      lipsync: false,
      captionLength: "short",
      upscale: false,
    });
    vi.mocked(triggerCreateContent).mockRejectedValue(new Error("Trigger unavailable"));
    const request = new NextRequest("http://localhost/api/content/create", { method: "POST" });

    const result = await createContentHandler(request);
    const body = await result.json();

    expect(result.status).toBe(500);
    expect(body).toEqual({
      status: "error",
      error: "Trigger unavailable",
    });
  });

  it("returns 400 when artist is not ready", async () => {
    vi.mocked(validateCreateContentBody).mockResolvedValue({
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
      template: "artist-caption-bedroom",
      lipsync: false,
      captionLength: "short",
      upscale: false,
    });
    vi.mocked(getArtistContentReadiness).mockResolvedValue({
      artist_slug: "gatsby-grace",
      ready: false,
      missing: [
        {
          file: "context/images/face-guide.png",
          severity: "required",
          fix: "Generate a face guide image before creating content.",
        },
      ],
      warnings: [],
    });
    const request = new NextRequest("http://localhost/api/content/create", { method: "POST" });

    const result = await createContentHandler(request);
    const body = await result.json();

    expect(result.status).toBe(400);
    expect(triggerCreateContent).not.toHaveBeenCalled();
    expect(body.ready).toBe(false);
    expect(Array.isArray(body.missing)).toBe(true);
  });
});

