import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateAddArtistRequest } from "../validateAddArtistRequest";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/accounts/resolveAddArtistAccountId", () => ({
  resolveAddArtistAccountId: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");
const { resolveAddArtistAccountId } = await import("@/lib/accounts/resolveAddArtistAccountId");

const ARTIST_ID = "11111111-1111-4111-8111-111111111111";
const AUTH_ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";
const TARGET_ACCOUNT_ID = "33333333-3333-4333-8333-333333333333";

function makeReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest("https://example.com/api/accounts/artists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("validateAddArtistRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a 400 response when artistId is missing (before auth)", async () => {
    const result = await validateAddArtistRequest(makeReq({}));

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns the auth error when no credential is provided", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 401 }),
    );

    const result = await validateAddArtistRequest(makeReq({ artistId: ARTIST_ID }));

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
    expect(resolveAddArtistAccountId).not.toHaveBeenCalled();
  });

  it("derives the account from the authenticated credential when no email is given", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: AUTH_ACCOUNT_ID,
      orgId: null,
      authToken: "token",
    });
    vi.mocked(resolveAddArtistAccountId).mockResolvedValue(AUTH_ACCOUNT_ID);

    const result = await validateAddArtistRequest(makeReq({ artistId: ARTIST_ID }));

    expect(resolveAddArtistAccountId).toHaveBeenCalledWith(AUTH_ACCOUNT_ID, undefined);
    expect(result).toEqual({ accountId: AUTH_ACCOUNT_ID, artistId: ARTIST_ID });
  });

  it("passes through the resolved target account when an email override is accepted", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: AUTH_ACCOUNT_ID,
      orgId: null,
      authToken: "token",
    });
    vi.mocked(resolveAddArtistAccountId).mockResolvedValue(TARGET_ACCOUNT_ID);

    const result = await validateAddArtistRequest(
      makeReq({ artistId: ARTIST_ID, email: "other@example.com" }),
    );

    expect(resolveAddArtistAccountId).toHaveBeenCalledWith(AUTH_ACCOUNT_ID, "other@example.com");
    expect(result).toEqual({ accountId: TARGET_ACCOUNT_ID, artistId: ARTIST_ID });
  });

  it("returns the resolver error when an email override is denied", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: AUTH_ACCOUNT_ID,
      orgId: null,
      authToken: "token",
    });
    vi.mocked(resolveAddArtistAccountId).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 403 }),
    );

    const result = await validateAddArtistRequest(
      makeReq({ artistId: ARTIST_ID, email: "other@example.com" }),
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });
});
