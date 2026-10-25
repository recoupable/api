import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "@/app/api/content/validate/route";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { resolveArtistSlug } from "@/lib/content/resolveArtistSlug";
import { getArtistContentReadiness } from "@/lib/content/getArtistContentReadiness";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/content/resolveArtistSlug", () => ({ resolveArtistSlug: vi.fn() }));
vi.mock("@/lib/content/getArtistContentReadiness", () => ({ getArtistContentReadiness: vi.fn() }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));

const artistId = "550e8400-e29b-41d4-a716-446655440000";
const request = (id: string | null = artistId) => {
  const url = new URL("http://localhost/api/content/validate");
  if (id !== null) url.searchParams.set("artist_account_id", id);
  return new NextRequest(url);
};

describe("GET /api/content/validate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-1",
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(resolveArtistSlug).mockResolvedValue("test-artist");
    vi.mocked(getArtistContentReadiness).mockResolvedValue({
      artist_account_id: artistId,
      ready: true,
      missing: [],
      warnings: [],
      githubRepo: "https://github.com/private/repo",
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it.each([null, "", "bad-id", " ", "' OR 1=1", `${artistId}extra`])(
    "rejects invalid artist ID %s before lookup",
    async id => {
      const response = await GET(request(id));
      expect(response.status).toBe(400);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(await response.json()).toEqual({
        status: "error",
        error: !id
          ? "artist_account_id query parameter is required"
          : "artist_account_id must be a valid UUID",
      });
      expect(resolveArtistSlug).not.toHaveBeenCalled();
      expect(getArtistContentReadiness).not.toHaveBeenCalled();
    },
  );

  it.each([401, 403])("preserves auth %s before malformed query validation", async status => {
    const denied = NextResponse.json({ error: "denied" }, { status });
    vi.mocked(validateAuthContext).mockResolvedValue(denied);
    expect(await GET(request("invalid"))).toBe(denied);
    expect(resolveArtistSlug).not.toHaveBeenCalled();
    expect(getArtistContentReadiness).not.toHaveBeenCalled();
  });

  it("preserves artist-not-found response", async () => {
    vi.mocked(resolveArtistSlug).mockResolvedValue(null);
    const response = await GET(request());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Artist not found for the provided artist_account_id",
    });
    expect(getArtistContentReadiness).not.toHaveBeenCalled();
  });

  it.each([true, false])("returns public readiness when ready is %s", async ready => {
    const publicReadiness = {
      artist_account_id: artistId,
      ready,
      missing: ready ? [] : ["config.json"],
      warnings: [],
    };
    vi.mocked(getArtistContentReadiness).mockResolvedValue({
      ...publicReadiness,
      githubRepo: "private/repo",
    });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "success", ...publicReadiness });
    expect(resolveArtistSlug).toHaveBeenCalledExactlyOnceWith(artistId);
    expect(getArtistContentReadiness).toHaveBeenCalledExactlyOnceWith({
      accountId: "account-1",
      artistAccountId: artistId,
      artistSlug: "test-artist",
    });
  });

  it.each(["auth", "lookup", "readiness"])("sanitizes thrown %s errors", async stage => {
    const dependency =
      stage === "auth"
        ? validateAuthContext
        : stage === "lookup"
          ? resolveArtistSlug
          : getArtistContentReadiness;
    vi.mocked(dependency).mockRejectedValue(new Error("private internal detail"));
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await response.json()).toEqual({
      status: "error",
      error: "Failed to validate content readiness",
    });
    if (stage !== "readiness") expect(getArtistContentReadiness).not.toHaveBeenCalled();
  });
});
