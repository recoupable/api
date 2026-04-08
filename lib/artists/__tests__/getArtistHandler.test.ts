import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getArtistHandler } from "../getArtistHandler";
import { validateGetArtistRequest } from "../validateGetArtistRequest";
import { getArtistById } from "../getArtistById";
import { validateAccountIdOverride } from "@/lib/auth/validateAccountIdOverride";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetArtistRequest", () => ({
  validateGetArtistRequest: vi.fn(),
}));

vi.mock("../getArtistById", () => ({
  getArtistById: vi.fn(),
}));

vi.mock("@/lib/auth/validateAccountIdOverride", () => ({
  validateAccountIdOverride: vi.fn(),
}));

const validUuid = "550e8400-e29b-41d4-a716-446655440000";

describe("getArtistHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the auth/validation response when params validation fails", async () => {
    vi.mocked(validateGetArtistRequest).mockResolvedValue(
      NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    );

    const req = new NextRequest(`http://localhost/api/artists/${validUuid}`);
    const res = await getArtistHandler(req, Promise.resolve({ id: validUuid }));

    expect(res.status).toBe(401);
    expect(getArtistById).not.toHaveBeenCalled();
  });

  it("returns 404 when the artist does not exist", async () => {
    vi.mocked(validateGetArtistRequest).mockResolvedValue({
      artistId: validUuid,
      requesterAccountId: validUuid,
    });
    vi.mocked(validateAccountIdOverride).mockResolvedValue({ accountId: validUuid });
    vi.mocked(getArtistById).mockResolvedValue(null);

    const req = new NextRequest(`http://localhost/api/artists/${validUuid}`);
    const res = await getArtistHandler(req, Promise.resolve({ id: validUuid }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Artist not found");
    expect(validateAccountIdOverride).toHaveBeenCalledWith({
      currentAccountId: validUuid,
      targetAccountId: validUuid,
    });
  });

  it("returns 200 with the merged artist payload", async () => {
    const artist = {
      account_id: validUuid,
      id: validUuid,
      name: "Test Artist",
      instruction: "Be specific",
      knowledges: [],
      label: "Indie",
      image: "https://example.com/artist.png",
      account_socials: [],
    };

    vi.mocked(validateGetArtistRequest).mockResolvedValue({
      artistId: validUuid,
      requesterAccountId: validUuid,
    });
    vi.mocked(getArtistById).mockResolvedValue(artist as never);
    vi.mocked(validateAccountIdOverride).mockResolvedValue({ accountId: validUuid });

    const req = new NextRequest(`http://localhost/api/artists/${validUuid}`);
    const res = await getArtistHandler(req, Promise.resolve({ id: validUuid }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.artist).toEqual(artist);
  });

  it("passes the request and path id to validation", async () => {
    vi.mocked(validateGetArtistRequest).mockResolvedValue({
      artistId: validUuid,
      requesterAccountId: validUuid,
    });
    vi.mocked(getArtistById).mockResolvedValue({ account_id: validUuid } as never);
    vi.mocked(validateAccountIdOverride).mockResolvedValue({ accountId: validUuid });

    const req = new NextRequest(`http://localhost/api/artists/${validUuid}`);
    await getArtistHandler(req, Promise.resolve({ id: validUuid }));

    expect(validateGetArtistRequest).toHaveBeenCalledWith(req, validUuid);
  });

  it("returns 403 when the authenticated account cannot access the artist", async () => {
    vi.mocked(validateGetArtistRequest).mockResolvedValue({
      artistId: validUuid,
      requesterAccountId: "11111111-1111-4111-8111-111111111111",
    });
    vi.mocked(validateAccountIdOverride).mockResolvedValue(
      NextResponse.json({ status: "error", error: "forbidden" }, { status: 403 }),
    );

    const req = new NextRequest(`http://localhost/api/artists/${validUuid}`);
    const res = await getArtistHandler(req, Promise.resolve({ id: validUuid }));

    expect(res.status).toBe(403);
    expect(getArtistById).not.toHaveBeenCalled();
  });
});
