import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";
import { validateLinkSpotifyArtistBody } from "../validateLinkSpotifyArtistBody";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));

describe("validateLinkSpotifyArtistBody", () => {
  it("accepts a valid body with only spotify_id", () => {
    const result = validateLinkSpotifyArtistBody({ spotify_id: "abc123" });
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({ spotify_id: "abc123" });
  });

  it("accepts optional name, account_id, organization_id", () => {
    const body = {
      spotify_id: "abc123",
      name: "Drake",
      account_id: "550e8400-e29b-41d4-a716-446655440000",
      organization_id: "660e8400-e29b-41d4-a716-446655440001",
    };
    const result = validateLinkSpotifyArtistBody(body);
    expect(result).toEqual(body);
  });

  it("returns 400 when spotify_id is missing", async () => {
    const result = validateLinkSpotifyArtistBody({});
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 when spotify_id is empty", () => {
    const result = validateLinkSpotifyArtistBody({ spotify_id: "" });
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 when account_id is not a UUID", () => {
    const result = validateLinkSpotifyArtistBody({ spotify_id: "abc", account_id: "not-a-uuid" });
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });
});
