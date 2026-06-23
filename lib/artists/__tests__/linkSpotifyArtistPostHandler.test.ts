import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { linkSpotifyArtistPostHandler } from "../linkSpotifyArtistPostHandler";

const mockValidateAuthContext = vi.fn();
const mockLinkSpotifyArtistToAccount = vi.fn();

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));
vi.mock("@/lib/artists/linkSpotifyArtistToAccount", () => ({
  linkSpotifyArtistToAccount: (...args: unknown[]) => mockLinkSpotifyArtistToAccount(...args),
}));

function createRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": "test-api-key",
  };
  return new NextRequest("http://localhost/api/artists/spotify-link", {
    method: "POST",
    headers: { ...defaultHeaders, ...headers },
    body: JSON.stringify(body),
  });
}

describe("linkSpotifyArtistPostHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAuthContext.mockResolvedValue({
      accountId: "api-key-account-id",
      orgId: null,
      authToken: "test-api-key",
    });
  });

  it("links a spotify artist to the authed account and returns 200", async () => {
    mockLinkSpotifyArtistToAccount.mockResolvedValue({
      artistId: "artist-1",
      created: true,
      linked: true,
    });

    const request = createRequest({ spotify_id: "abc123", name: "Drake" });
    const response = await linkSpotifyArtistPostHandler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      artist_id: "artist-1",
      created: true,
      linked: true,
    });
    expect(mockLinkSpotifyArtistToAccount).toHaveBeenCalledWith({
      spotifyId: "abc123",
      accountId: "api-key-account-id",
      name: "Drake",
      organizationId: undefined,
    });
  });

  it("passes account_id override and organization_id through", async () => {
    mockValidateAuthContext.mockResolvedValue({
      accountId: "550e8400-e29b-41d4-a716-446655440000",
      orgId: "org-account-id",
      authToken: "test-api-key",
    });
    mockLinkSpotifyArtistToAccount.mockResolvedValue({
      artistId: "artist-1",
      created: false,
      linked: false,
    });

    const request = createRequest({
      spotify_id: "abc123",
      account_id: "550e8400-e29b-41d4-a716-446655440000",
      organization_id: "660e8400-e29b-41d4-a716-446655440001",
    });
    await linkSpotifyArtistPostHandler(request);

    expect(mockValidateAuthContext).toHaveBeenCalledWith(request, {
      accountId: "550e8400-e29b-41d4-a716-446655440000",
      organizationId: "660e8400-e29b-41d4-a716-446655440001",
    });
    expect(mockLinkSpotifyArtistToAccount).toHaveBeenCalledWith({
      spotifyId: "abc123",
      accountId: "550e8400-e29b-41d4-a716-446655440000",
      name: undefined,
      organizationId: "660e8400-e29b-41d4-a716-446655440001",
    });
  });

  it("returns 400 when spotify_id is missing", async () => {
    const request = createRequest({});
    const response = await linkSpotifyArtistPostHandler(request);
    expect(response.status).toBe(400);
    expect(mockValidateAuthContext).not.toHaveBeenCalled();
  });

  it("returns 401 when auth is missing", async () => {
    mockValidateAuthContext.mockResolvedValue(
      NextResponse.json(
        { status: "error", error: "Exactly one of x-api-key or Authorization must be provided" },
        { status: 401 },
      ),
    );

    const request = new NextRequest("http://localhost/api/artists/spotify-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spotify_id: "abc123" }),
    });
    const response = await linkSpotifyArtistPostHandler(request);
    expect(response.status).toBe(401);
  });

  it("returns 403 when org key lacks access to account_id", async () => {
    mockValidateAuthContext.mockResolvedValue(
      NextResponse.json(
        { status: "error", error: "Access denied to specified account_id" },
        { status: 403 },
      ),
    );

    const request = createRequest({
      spotify_id: "abc123",
      account_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    const response = await linkSpotifyArtistPostHandler(request);
    expect(response.status).toBe(403);
  });

  it("returns 500 when linking throws", async () => {
    mockLinkSpotifyArtistToAccount.mockRejectedValue(new Error("Failed to create artist"));

    const request = createRequest({ spotify_id: "abc123" });
    const response = await linkSpotifyArtistPostHandler(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to create artist");
  });
});
