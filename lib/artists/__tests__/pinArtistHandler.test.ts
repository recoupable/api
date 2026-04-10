import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { pinArtistHandler } from "../pinArtistHandler";
import { pinArtist } from "../pinArtist";
import { validateArtistAccessRequest } from "../validateArtistAccessRequest";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateArtistAccessRequest", () => ({
  validateArtistAccessRequest: vi.fn(),
}));

vi.mock("../pinArtist", () => ({
  pinArtist: vi.fn(),
}));

describe("pinArtistHandler", () => {
  const artistId = "550e8400-e29b-41d4-a716-446655440000";
  const requesterAccountId = "660e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the validation response when request validation fails", async () => {
    const validationError = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateArtistAccessRequest).mockResolvedValue(validationError);

    const request = new NextRequest(`http://localhost/api/artists/${artistId}/pin`, {
      method: "POST",
    });

    const response = await pinArtistHandler(request, Promise.resolve({ id: artistId }), true);

    expect(response).toBe(validationError);
    expect(pinArtist).not.toHaveBeenCalled();
  });

  it("returns success when the artist is pinned", async () => {
    vi.mocked(validateArtistAccessRequest).mockResolvedValue({
      artistId,
      requesterAccountId,
    });
    vi.mocked(pinArtist).mockResolvedValue();

    const request = new NextRequest(`http://localhost/api/artists/${artistId}/pin`, {
      method: "POST",
    });

    const response = await pinArtistHandler(request, Promise.resolve({ id: artistId }), true);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      artistId,
      pinned: true,
    });
  });

  it("returns success when the artist is unpinned", async () => {
    vi.mocked(validateArtistAccessRequest).mockResolvedValue({
      artistId,
      requesterAccountId,
    });
    vi.mocked(pinArtist).mockResolvedValue();

    const request = new NextRequest(`http://localhost/api/artists/${artistId}/pin`, {
      method: "DELETE",
    });

    const response = await pinArtistHandler(request, Promise.resolve({ id: artistId }), false);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      artistId,
      pinned: false,
    });
  });

  it("returns a generic 500 response when validation throws", async () => {
    vi.mocked(validateArtistAccessRequest).mockRejectedValue(new Error("db exploded"));

    const request = new NextRequest(`http://localhost/api/artists/${artistId}/pin`, {
      method: "POST",
    });

    const response = await pinArtistHandler(request, Promise.resolve({ id: artistId }), true);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      status: "error",
      error: "Internal server error",
    });
  });
});
