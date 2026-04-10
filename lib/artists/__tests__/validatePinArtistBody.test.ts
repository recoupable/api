import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validatePinArtistBody } from "../validatePinArtistBody";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkAccountArtistAccess } from "../checkAccountArtistAccess";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";

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

/**
 * Creates a request for the pin artist validator tests.
 *
 * @param body - JSON payload to attach to the request
 * @returns A POST request targeting the pin artist endpoint
 */
function createRequest(body: unknown) {
  return new NextRequest("http://localhost/api/artists/pin", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("validatePinArtistBody", () => {
  const artistId = "550e8400-e29b-41d4-a716-446655440000";
  const requesterAccountId = "660e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when the body is invalid", async () => {
    const response = await validatePinArtistBody(createRequest({ pinned: true }));

    expect(response).toBeInstanceOf(NextResponse);
    const body = await (response as NextResponse).json();

    expect((response as NextResponse).status).toBe(400);
    expect(body).toEqual({
      status: "error",
      missing_fields: ["artistId"],
      error: "artistId must be a valid UUID",
    });
  });

  it("returns the auth response when authentication fails", async () => {
    const authError = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authError);

    const response = await validatePinArtistBody(createRequest({ artistId, pinned: true }));

    expect(response).toBe(authError);
  });

  it("returns 404 when the artist does not exist", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: requesterAccountId });
    vi.mocked(selectAccounts).mockResolvedValue([]);

    const response = await validatePinArtistBody(createRequest({ artistId, pinned: false }));
    const body = await (response as NextResponse).json();

    expect((response as NextResponse).status).toBe(404);
    expect(body).toEqual({
      status: "error",
      error: "Artist not found",
    });
  });

  it("returns 403 when the requester cannot access the artist", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: requesterAccountId });
    vi.mocked(selectAccounts).mockResolvedValue([{ id: artistId }] as never);
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);

    const response = await validatePinArtistBody(createRequest({ artistId, pinned: true }));
    const body = await (response as NextResponse).json();

    expect((response as NextResponse).status).toBe(403);
    expect(body).toEqual({
      status: "error",
      error: "Forbidden",
    });
  });

  it("returns the validated request when the body and auth are valid", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: requesterAccountId });
    vi.mocked(selectAccounts).mockResolvedValue([{ id: artistId }] as never);
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);

    const response = await validatePinArtistBody(createRequest({ artistId, pinned: true }));

    expect(response).toEqual({
      artistId,
      pinned: true,
      requesterAccountId,
    });
  });
});
