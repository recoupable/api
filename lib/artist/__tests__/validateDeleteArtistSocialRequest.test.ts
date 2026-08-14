import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateDeleteArtistSocialRequest } from "../validateDeleteArtistSocialRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({ selectAccounts: vi.fn() }));
vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({ checkAccountArtistAccess: vi.fn() }));
vi.mock("@/lib/supabase/account_socials/selectAccountSocials", () => ({
  selectAccountSocials: vi.fn(),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const ARTIST_ID = "550e8400-e29b-41d4-a716-446655440000";
const SOCIAL_ID = "660e8400-e29b-41d4-a716-446655440111";
const REQUESTER_ID = "770e8400-e29b-41d4-a716-446655440222";

const request = () =>
  new NextRequest(`http://localhost/api/artists/${ARTIST_ID}/socials/${SOCIAL_ID}`, {
    method: "DELETE",
  });

const mockAuthOk = () =>
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId: REQUESTER_ID,
    orgId: null,
    authToken: "token",
  } as never);

describe("validateDeleteArtistSocialRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when the artist id is not a valid UUID", async () => {
    const res = await validateDeleteArtistSocialRequest(request(), "not-a-uuid", SOCIAL_ID);
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns 400 when the social id is not a valid UUID", async () => {
    const res = await validateDeleteArtistSocialRequest(request(), ARTIST_ID, "not-a-uuid");
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns the auth error response when authentication fails", async () => {
    const err = NextResponse.json({}, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(err);
    const res = await validateDeleteArtistSocialRequest(request(), ARTIST_ID, SOCIAL_ID);
    expect(res).toBe(err);
  });

  it("returns 404 when the artist does not exist", async () => {
    mockAuthOk();
    vi.mocked(selectAccounts).mockResolvedValue([]);
    const res = await validateDeleteArtistSocialRequest(request(), ARTIST_ID, SOCIAL_ID);
    expect((res as NextResponse).status).toBe(404);
    expect(checkAccountArtistAccess).not.toHaveBeenCalled();
  });

  it("returns 403 when the requester cannot access the artist", async () => {
    mockAuthOk();
    vi.mocked(selectAccounts).mockResolvedValue([{ id: ARTIST_ID }] as never);
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);
    const res = await validateDeleteArtistSocialRequest(request(), ARTIST_ID, SOCIAL_ID);
    expect((res as NextResponse).status).toBe(403);
    expect(selectAccountSocials).not.toHaveBeenCalled();
  });

  it("returns 404 when the social is not linked to the artist", async () => {
    mockAuthOk();
    vi.mocked(selectAccounts).mockResolvedValue([{ id: ARTIST_ID }] as never);
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(selectAccountSocials).mockResolvedValue([]);
    const res = await validateDeleteArtistSocialRequest(request(), ARTIST_ID, SOCIAL_ID);
    expect((res as NextResponse).status).toBe(404);
    expect(selectAccountSocials).toHaveBeenCalledWith({
      accountId: ARTIST_ID,
      socialId: SOCIAL_ID,
    });
  });

  it("returns validated ids when everything passes", async () => {
    mockAuthOk();
    vi.mocked(selectAccounts).mockResolvedValue([{ id: ARTIST_ID }] as never);
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(selectAccountSocials).mockResolvedValue([
      { account_id: ARTIST_ID, social_id: SOCIAL_ID },
    ] as never);
    const res = await validateDeleteArtistSocialRequest(request(), ARTIST_ID, SOCIAL_ID);
    expect(res).toEqual({ artistId: ARTIST_ID, socialId: SOCIAL_ID });
  });
});
