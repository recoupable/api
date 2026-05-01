import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetArtistSocialsRequest } from "../validateGetArtistSocialsRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({ selectAccounts: vi.fn() }));
vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({ checkAccountArtistAccess: vi.fn() }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const ARTIST_ID = "550e8400-e29b-41d4-a716-446655440000";
const ACCOUNT_ID = "660e8400-e29b-41d4-a716-446655440000";
const authResult = { accountId: ACCOUNT_ID, authToken: "t", orgId: null };

const makeRequest = (path = `/api/artists/${ARTIST_ID}/socials`) =>
  new NextRequest(`http://localhost${path}`, { headers: { "x-api-key": "k" } });

describe("validateGetArtistSocialsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(selectAccounts).mockResolvedValue([{ id: ARTIST_ID } as never]);
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(validateAuthContext).mockResolvedValue(authResult);
  });

  it.each([
    ["invalid uuid", "not-a-uuid", `/api/artists/not-a-uuid/socials`],
    ["page=0", ARTIST_ID, `/api/artists/${ARTIST_ID}/socials?page=0`],
    ["limit>max", ARTIST_ID, `/api/artists/${ARTIST_ID}/socials?limit=500`],
  ])("returns 400 for %s", async (_, id, path) => {
    const res = (await validateGetArtistSocialsRequest(makeRequest(path), id)) as NextResponse;
    expect(res.status).toBe(400);
  });

  it("propagates auth error", async () => {
    const err = NextResponse.json({}, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(err);
    expect(await validateGetArtistSocialsRequest(makeRequest(), ARTIST_ID)).toBe(err);
    expect(selectAccounts).not.toHaveBeenCalled();
  });

  it("returns 404 when artist not found", async () => {
    vi.mocked(selectAccounts).mockResolvedValue([]);
    const res = (await validateGetArtistSocialsRequest(makeRequest(), ARTIST_ID)) as NextResponse;
    expect(res.status).toBe(404);
    expect(checkAccountArtistAccess).not.toHaveBeenCalled();
  });

  it("returns 403 when requester lacks access", async () => {
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);
    const res = (await validateGetArtistSocialsRequest(makeRequest(), ARTIST_ID)) as NextResponse;
    expect(res.status).toBe(403);
    expect(checkAccountArtistAccess).toHaveBeenCalledWith(ACCOUNT_ID, ARTIST_ID);
  });

  it("returns validated payload with defaults and parsed query", async () => {
    expect(await validateGetArtistSocialsRequest(makeRequest(), ARTIST_ID)).toEqual({
      artist_account_id: ARTIST_ID,
      page: 1,
      limit: 20,
    });
    const path = `/api/artists/${ARTIST_ID}/socials?page=3&limit=50`;
    expect(await validateGetArtistSocialsRequest(makeRequest(path), ARTIST_ID)).toEqual({
      artist_account_id: ARTIST_ID,
      page: 3,
      limit: 50,
    });
  });
});
