import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { pinArtistHandler } from "../pinArtistHandler";
import { validatePinArtistBody } from "../validatePinArtistBody";
import { pinArtist } from "../pinArtist";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validatePinArtistBody", () => ({
  validatePinArtistBody: vi.fn(),
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
    vi.mocked(validatePinArtistBody).mockResolvedValue(validationError);

    const request = new NextRequest("http://localhost/api/artists/pin", {
      method: "POST",
      body: JSON.stringify({ artistId, pinned: true }),
    });

    const response = await pinArtistHandler(request);

    expect(response).toBe(validationError);
    expect(pinArtist).not.toHaveBeenCalled();
  });

  it("returns success when the pin is updated", async () => {
    vi.mocked(validatePinArtistBody).mockResolvedValue({
      artistId,
      pinned: true,
      requesterAccountId,
    });
    vi.mocked(pinArtist).mockResolvedValue();

    const request = new NextRequest("http://localhost/api/artists/pin", {
      method: "POST",
      body: JSON.stringify({ artistId, pinned: true }),
    });

    const response = await pinArtistHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      artistId,
      pinned: true,
    });
  });
});
