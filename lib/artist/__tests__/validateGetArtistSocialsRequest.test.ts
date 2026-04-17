import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetArtistSocialsRequest } from "../validateGetArtistSocialsRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({
  selectAccounts: vi.fn(),
}));

vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

describe("validateGetArtistSocialsRequest", () => {
  const validArtistId = "550e8400-e29b-41d4-a716-446655440000";
  const authenticatedAccountId = "660e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.clearAllMocks();
    // Happy-path defaults; individual tests override as needed.
    vi.mocked(selectAccounts).mockResolvedValue([{ id: validArtistId } as never]);
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
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
    expect(selectAccounts).not.toHaveBeenCalled();
  });

  it("returns 404 when the artist account does not exist", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: authenticatedAccountId,
      authToken: "test-token",
      orgId: null,
    });
    vi.mocked(selectAccounts).mockResolvedValue([]);

    const request = new NextRequest(`http://localhost/api/artists/${validArtistId}/socials`, {
      headers: { "x-api-key": "test-key" },
    });

    const result = await validateGetArtistSocialsRequest(request, validArtistId);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(404);
    expect(checkAccountArtistAccess).not.toHaveBeenCalled();
  });

  it("returns 403 when the requester does not have access to the artist", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: authenticatedAccountId,
      authToken: "test-token",
      orgId: null,
    });
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);

    const request = new NextRequest(`http://localhost/api/artists/${validArtistId}/socials`, {
      headers: { "x-api-key": "test-key" },
    });

    const result = await validateGetArtistSocialsRequest(request, validArtistId);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
    expect(checkAccountArtistAccess).toHaveBeenCalledWith(authenticatedAccountId, validArtistId);
    const body = await (result as NextResponse).json();
    expect(body).toEqual({ status: "error", error: "Unauthorized" });
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
