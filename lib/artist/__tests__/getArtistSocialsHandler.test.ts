import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getArtistSocialsHandler } from "../getArtistSocialsHandler";
import { getArtistSocials } from "../getArtistSocials";
import { validateGetArtistSocialsRequest } from "../validateGetArtistSocialsRequest";

vi.mock("../getArtistSocials", () => ({
  getArtistSocials: vi.fn(),
}));

vi.mock("../validateGetArtistSocialsRequest", () => ({
  validateGetArtistSocialsRequest: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

describe("getArtistSocialsHandler", () => {
  const validArtistId = "550e8400-e29b-41d4-a716-446655440000";
  const authenticatedAccountId = "660e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the validator's NextResponse when auth is missing", async () => {
    const unauthorized = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateGetArtistSocialsRequest).mockResolvedValue(unauthorized);

    const request = new NextRequest(`http://localhost/api/artists/${validArtistId}/socials`);
    const response = await getArtistSocialsHandler(request, validArtistId);

    expect(response).toBe(unauthorized);
    expect(getArtistSocials).not.toHaveBeenCalled();
  });

  it("returns the validator's NextResponse for invalid UUID", async () => {
    const badRequest = NextResponse.json({ error: "id must be a valid UUID" }, { status: 400 });
    vi.mocked(validateGetArtistSocialsRequest).mockResolvedValue(badRequest);

    const request = new NextRequest("http://localhost/api/artists/not-a-uuid/socials", {
      headers: { "x-api-key": "test-key" },
    });
    const response = await getArtistSocialsHandler(request, "not-a-uuid");

    expect(response).toBe(badRequest);
    expect(getArtistSocials).not.toHaveBeenCalled();
  });

  it("returns 200 with socials on success", async () => {
    vi.mocked(validateGetArtistSocialsRequest).mockResolvedValue({
      artistAccountId: validArtistId,
      page: 1,
      limit: 20,
      authContext: {
        accountId: authenticatedAccountId,
        authToken: "test-token",
        orgId: null,
      },
    });

    const successBody = {
      status: "success" as const,
      socials: [],
      pagination: { total_count: 0, page: 1, limit: 20, total_pages: 0 },
    };
    vi.mocked(getArtistSocials).mockResolvedValue(successBody);

    const request = new NextRequest(`http://localhost/api/artists/${validArtistId}/socials`, {
      headers: { "x-api-key": "test-key" },
    });
    const response = await getArtistSocialsHandler(request, validArtistId);

    expect(response.status).toBe(200);
    expect(getArtistSocials).toHaveBeenCalledWith({
      artist_account_id: validArtistId,
      page: 1,
      limit: 20,
    });
    const body = await response.json();
    expect(body).toEqual(successBody);
  });

  it("returns 500 when getArtistSocials reports an error status", async () => {
    vi.mocked(validateGetArtistSocialsRequest).mockResolvedValue({
      artistAccountId: validArtistId,
      page: 1,
      limit: 20,
      authContext: {
        accountId: authenticatedAccountId,
        authToken: "test-token",
        orgId: null,
      },
    });

    vi.mocked(getArtistSocials).mockResolvedValue({
      status: "error",
      message: "db failure",
      socials: [],
      pagination: { total_count: 0, page: 1, limit: 20, total_pages: 0 },
    });

    const request = new NextRequest(`http://localhost/api/artists/${validArtistId}/socials`, {
      headers: { "x-api-key": "test-key" },
    });
    const response = await getArtistSocialsHandler(request, validArtistId);

    expect(response.status).toBe(500);
  });
});
