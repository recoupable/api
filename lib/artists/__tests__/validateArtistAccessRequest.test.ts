import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateArtistAccessRequest } from "../validateArtistAccessRequest";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkAccountArtistAccess } from "../checkAccountArtistAccess";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";

vi.mock("@/lib/accounts/validateAccountParams", () => ({
  validateAccountParams: vi.fn(),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("../checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: vi.fn(),
}));

vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({
  selectAccounts: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

describe("validateArtistAccessRequest", () => {
  const artistId = "550e8400-e29b-41d4-a716-446655440000";
  const requesterAccountId = "660e8400-e29b-41d4-a716-446655440000";
  const request = new NextRequest(`http://localhost/api/artists/${artistId}/pin`, {
    method: "POST",
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the account params response when the id is invalid", async () => {
    const invalidResponse = NextResponse.json({ error: "Invalid id" }, { status: 400 });
    vi.mocked(validateAccountParams).mockReturnValue(invalidResponse);

    const response = await validateArtistAccessRequest(request, "bad-id");

    expect(response).toBe(invalidResponse);
  });

  it("returns the auth response when authentication fails", async () => {
    vi.mocked(validateAccountParams).mockReturnValue({ id: artistId });
    const authError = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authError);

    const response = await validateArtistAccessRequest(request, artistId);

    expect(response).toBe(authError);
  });

  it("returns 404 when the artist does not exist", async () => {
    vi.mocked(validateAccountParams).mockReturnValue({ id: artistId });
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: requesterAccountId });
    vi.mocked(selectAccounts).mockResolvedValue([]);

    const response = await validateArtistAccessRequest(request, artistId);
    const body = await (response as NextResponse).json();

    expect((response as NextResponse).status).toBe(404);
    expect(body).toEqual({
      status: "error",
      error: "Artist not found",
    });
  });

  it("returns 403 when the requester cannot access the artist", async () => {
    vi.mocked(validateAccountParams).mockReturnValue({ id: artistId });
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: requesterAccountId });
    vi.mocked(selectAccounts).mockResolvedValue([{ id: artistId }] as never);
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);

    const response = await validateArtistAccessRequest(request, artistId);
    const body = await (response as NextResponse).json();

    expect((response as NextResponse).status).toBe(403);
    expect(body).toEqual({
      status: "error",
      error: "Forbidden",
    });
  });

  it("returns validated artist access when the requester has access", async () => {
    vi.mocked(validateAccountParams).mockReturnValue({ id: artistId });
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: requesterAccountId });
    vi.mocked(selectAccounts).mockResolvedValue([{ id: artistId }] as never);
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);

    const response = await validateArtistAccessRequest(request, artistId);

    expect(response).toEqual({
      artistId,
      requesterAccountId,
    });
  });
});
