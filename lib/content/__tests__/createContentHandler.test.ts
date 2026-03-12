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

vi.mock("@/lib/supabase/account_snapshots/selectAccountSnapshots", () => ({
  selectAccountSnapshots: vi.fn(),
}));

describe("createContentHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getArtistContentReadiness).mockResolvedValue({
      artist_account_id: "art_456",
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

  it("returns 202 with runIds when trigger succeeds", async () => {
    vi.mocked(validateCreateContentBody).mockResolvedValue({
      accountId: "acc_123",
      artistAccountId: "art_456",
      artistSlug: "gatsby-grace",
      template: "artist-caption-bedroom",
      lipsync: false,
      captionLength: "short",
      upscale: false,
      batch: 1,
    });
    vi.mocked(triggerCreateContent).mockResolvedValue({ id: "run_abc123" } as never);
    const request = new NextRequest("http://localhost/api/content/create", { method: "POST" });

    const result = await createContentHandler(request);
    const body = await result.json();

    expect(result.status).toBe(202);
    expect(body.runIds).toEqual(["run_abc123"]);
    expect(body.status).toBe("triggered");
    expect(body.artist_account_id).toBe("art_456");
  });

  it("returns 202 with empty runIds and failed count when trigger fails", async () => {
    vi.mocked(validateCreateContentBody).mockResolvedValue({
      accountId: "acc_123",
      artistAccountId: "art_456",
      artistSlug: "gatsby-grace",
      template: "artist-caption-bedroom",
      lipsync: false,
      captionLength: "short",
      upscale: false,
      batch: 1,
    });
    vi.mocked(triggerCreateContent).mockRejectedValue(new Error("Trigger unavailable"));
    const request = new NextRequest("http://localhost/api/content/create", { method: "POST" });

    const result = await createContentHandler(request);
    const body = await result.json();

    expect(result.status).toBe(202);
    expect(body.runIds).toEqual([]);
    expect(body.failed).toBe(1);
  });

  it("still triggers when readiness check finds missing files (best-effort)", async () => {
    vi.mocked(validateCreateContentBody).mockResolvedValue({
      accountId: "acc_123",
      artistAccountId: "art_456",
      artistSlug: "gatsby-grace",
      template: "artist-caption-bedroom",
      lipsync: false,
      captionLength: "short",
      upscale: false,
      batch: 1,
    });
    vi.mocked(getArtistContentReadiness).mockResolvedValue({
      artist_account_id: "art_456",
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

    // Best-effort: validation doesn't block, task handles its own file discovery
    expect(result.status).toBe(202);
    expect(body.runIds).toBeDefined();
  });
});

