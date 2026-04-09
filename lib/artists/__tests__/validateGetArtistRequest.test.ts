import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetArtistRequest } from "../validateGetArtistRequest";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkAccountArtistAccess } from "../checkAccountArtistAccess";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/accounts/validateAccountParams", () => ({
  validateAccountParams: vi.fn(),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("../checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: vi.fn(),
}));

const validUuid = "550e8400-e29b-41d4-a716-446655440000";

describe("validateGetArtistRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when the artist id is invalid", async () => {
    vi.mocked(validateAccountParams).mockReturnValue(
      NextResponse.json({ error: "invalid UUID" }, { status: 400 }),
    );

    const req = new NextRequest("http://localhost/api/artists/not-valid");
    const result = await validateGetArtistRequest(req, "not-valid");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateAccountParams).mockReturnValue({ id: validUuid });
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    );

    const req = new NextRequest(`http://localhost/api/artists/${validUuid}`);
    const result = await validateGetArtistRequest(req, validUuid);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
    expect(validateAuthContext).toHaveBeenCalledWith(req);
    expect(checkAccountArtistAccess).not.toHaveBeenCalled();
  });

  it("returns 403 when the authenticated account cannot access the artist", async () => {
    vi.mocked(validateAccountParams).mockReturnValue({ id: validUuid });
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "11111111-1111-4111-8111-111111111111",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);

    const req = new NextRequest(`http://localhost/api/artists/${validUuid}`);
    const result = await validateGetArtistRequest(req, validUuid);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
    expect(checkAccountArtistAccess).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      validUuid,
    );
  });

  it("returns the validated artist id when auth succeeds", async () => {
    vi.mocked(validateAccountParams).mockReturnValue({ id: validUuid });
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: validUuid,
      orgId: null,
      authToken: "token",
    });

    const req = new NextRequest(`http://localhost/api/artists/${validUuid}`);
    const result = await validateGetArtistRequest(req, validUuid);

    expect(result).toEqual({
      artistId: validUuid,
      requesterAccountId: validUuid,
    });
    expect(validateAccountParams).toHaveBeenCalledWith(validUuid);
    expect(validateAuthContext).toHaveBeenCalledWith(req);
    expect(checkAccountArtistAccess).not.toHaveBeenCalled();
  });

  it("returns the validated artist id when the authenticated account can access the artist", async () => {
    vi.mocked(validateAccountParams).mockReturnValue({ id: validUuid });
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "11111111-1111-4111-8111-111111111111",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);

    const req = new NextRequest(`http://localhost/api/artists/${validUuid}`);
    const result = await validateGetArtistRequest(req, validUuid);

    expect(result).toEqual({
      artistId: validUuid,
      requesterAccountId: "11111111-1111-4111-8111-111111111111",
    });
    expect(checkAccountArtistAccess).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      validUuid,
    );
  });
});
