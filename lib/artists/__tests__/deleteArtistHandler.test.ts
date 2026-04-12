import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { deleteArtistHandler } from "../deleteArtistHandler";
import { validateDeleteArtistRequest } from "../validateDeleteArtistRequest";
import { deleteArtist } from "../deleteArtist";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateDeleteArtistRequest", () => ({
  validateDeleteArtistRequest: vi.fn(),
}));

vi.mock("../deleteArtist", () => ({
  deleteArtist: vi.fn(),
}));

describe("deleteArtistHandler", () => {
  const artistId = "550e8400-e29b-41d4-a716-446655440000";
  const requesterAccountId = "660e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the validation response when request validation fails", async () => {
    const validationError = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateDeleteArtistRequest).mockResolvedValue(validationError);

    const request = new NextRequest(`http://localhost/api/artists/${artistId}`, {
      method: "DELETE",
    });

    const response = await deleteArtistHandler(request, Promise.resolve({ id: artistId }));

    expect(response).toBe(validationError);
    expect(deleteArtist).not.toHaveBeenCalled();
  });

  it("returns success when the artist is deleted", async () => {
    vi.mocked(validateDeleteArtistRequest).mockResolvedValue({
      artistId,
      requesterAccountId,
    });
    vi.mocked(deleteArtist).mockResolvedValue(artistId);

    const request = new NextRequest(`http://localhost/api/artists/${artistId}`, {
      method: "DELETE",
    });

    const response = await deleteArtistHandler(request, Promise.resolve({ id: artistId }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      artistId,
    });
  });
});
