import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetArtistSocialsRequest } from "../validateGetArtistSocialsRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

describe("validateGetArtistSocialsRequest", () => {
  const validArtistId = "550e8400-e29b-41d4-a716-446655440000";
  const authenticatedAccountId = "660e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when the artist id is not a UUID", async () => {
    const request = new NextRequest("http://localhost/api/artists/not-a-uuid/socials", {
      headers: { "x-api-key": "test-key" },
    });

    const result = await validateGetArtistSocialsRequest(request, "not-a-uuid");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns 400 when page is not a positive integer", async () => {
    const request = new NextRequest(
      `http://localhost/api/artists/${validArtistId}/socials?page=0`,
      { headers: { "x-api-key": "test-key" } },
    );

    const result = await validateGetArtistSocialsRequest(request, validArtistId);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns 400 when limit exceeds the max", async () => {
    const request = new NextRequest(
      `http://localhost/api/artists/${validArtistId}/socials?limit=500`,
      { headers: { "x-api-key": "test-key" } },
    );

    const result = await validateGetArtistSocialsRequest(request, validArtistId);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns the auth error when authentication fails", async () => {
    const authError = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authError);

    const request = new NextRequest(`http://localhost/api/artists/${validArtistId}/socials`);

    const result = await validateGetArtistSocialsRequest(request, validArtistId);

    expect(result).toBe(authError);
    expect(validateAuthContext).toHaveBeenCalledWith(request);
  });

  it("returns validated payload with default pagination when no query provided", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: authenticatedAccountId,
      authToken: "test-token",
      orgId: null,
    });

    const request = new NextRequest(`http://localhost/api/artists/${validArtistId}/socials`, {
      headers: { "x-api-key": "test-key" },
    });

    const result = await validateGetArtistSocialsRequest(request, validArtistId);

    expect(result).toEqual({
      artistAccountId: validArtistId,
      page: 1,
      limit: 20,
      authContext: {
        accountId: authenticatedAccountId,
        authToken: "test-token",
        orgId: null,
      },
    });
  });

  it("returns validated payload with parsed page/limit", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: authenticatedAccountId,
      authToken: "test-token",
      orgId: null,
    });

    const request = new NextRequest(
      `http://localhost/api/artists/${validArtistId}/socials?page=3&limit=50`,
      { headers: { "x-api-key": "test-key" } },
    );

    const result = await validateGetArtistSocialsRequest(request, validArtistId);

    expect(result).toEqual({
      artistAccountId: validArtistId,
      page: 3,
      limit: 50,
      authContext: {
        accountId: authenticatedAccountId,
        authToken: "test-token",
        orgId: null,
      },
    });
  });
});
