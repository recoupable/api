import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getArtistPublicProfileMock } = vi.hoisted(() => ({
  getArtistPublicProfileMock: vi.fn(),
}));

vi.mock("@/lib/artist/getArtistPublicProfile", () => ({
  getArtistPublicProfile: getArtistPublicProfileMock,
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const { getArtistProfileHandler } = await import("@/lib/artist/getArtistProfileHandler");

const ARTIST = "5e9eca42-b5af-47ef-83c9-3e498506a3d6";
const req = () => new NextRequest(`https://api.recoupable.dev/api/artists/${ARTIST}/profile`);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("getArtistProfileHandler", () => {
  it("returns 200 with the profile and CORS headers, no auth consulted", async () => {
    const profile = { id: ARTIST, name: "Brauxelion", image: null, socials: [], catalogs: [] };
    getArtistPublicProfileMock.mockResolvedValue(profile);

    const res = await getArtistProfileHandler(req(), ARTIST);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(profile);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  // Every neighbouring artist route is dynamic and sets no Cache-Control; a
  // shared-cache directive here let the CDN serve writes minutes late
  // (recoupable/app#1984), so the response must carry none.
  it("sets no Cache-Control header, so no shared cache can hold a stale profile", async () => {
    getArtistPublicProfileMock.mockResolvedValue({ id: ARTIST, name: "Brauxelion" });

    const res = await getArtistProfileHandler(req(), ARTIST);

    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  it("returns 404 when the account is not an artist", async () => {
    getArtistPublicProfileMock.mockResolvedValue(null);

    const res = await getArtistProfileHandler(req(), ARTIST);

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ status: "error", error: "Artist not found" });
  });

  // A malformed id cannot exist, so it gets the same 404 as an unknown one —
  // no separate 400 that would distinguish "bad shape" from "not found".
  it("returns the identical 404 for a malformed id without touching the database", async () => {
    const res = await getArtistProfileHandler(req(), "not-a-uuid");

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ status: "error", error: "Artist not found" });
    expect(getArtistPublicProfileMock).not.toHaveBeenCalled();
  });

  it("returns 500 with a generic body when the lookup throws", async () => {
    getArtistPublicProfileMock.mockRejectedValue(new Error("db down: secret-connection-string"));

    const res = await getArtistProfileHandler(req(), ARTIST);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ status: "error", error: "Internal server error" });
  });
});
