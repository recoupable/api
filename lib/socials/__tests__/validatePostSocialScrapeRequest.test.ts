import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validatePostSocialScrapeRequest } from "../validatePostSocialScrapeRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { selectAccountSocialsBySocialId } from "@/lib/supabase/account_socials/selectAccountSocialsBySocialId";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/socials/selectSocials", () => ({ selectSocials: vi.fn() }));
vi.mock("@/lib/supabase/account_socials/selectAccountSocialsBySocialId", () => ({
  selectAccountSocialsBySocialId: vi.fn(),
}));
vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({ checkAccountArtistAccess: vi.fn() }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const SOCIAL_ID = "550e8400-e29b-41d4-a716-446655440000";
const ARTIST_ID = "660e8400-e29b-41d4-a716-446655440000";
const ACCOUNT_ID = "770e8400-e29b-41d4-a716-446655440000";
const authResult = { accountId: ACCOUNT_ID, authToken: "t", orgId: null };

const makeRequest = () =>
  new NextRequest(`http://localhost/api/socials/${SOCIAL_ID}/scrape`, {
    method: "POST",
    headers: { "x-api-key": "k" },
  });

describe("validatePostSocialScrapeRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue(authResult);
    vi.mocked(selectSocials).mockResolvedValue([{ id: SOCIAL_ID } as never]);
    vi.mocked(selectAccountSocialsBySocialId).mockResolvedValue([
      { account_id: ARTIST_ID } as never,
    ]);
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
  });

  it.each([["not-a-uuid"], [""], ["123"]])("returns 400 for invalid uuid %s", async id => {
    const res = (await validatePostSocialScrapeRequest(makeRequest(), id)) as NextResponse;
    expect(res.status).toBe(400);
  });

  it("propagates auth error", async () => {
    const err = NextResponse.json({}, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(err);
    expect(await validatePostSocialScrapeRequest(makeRequest(), SOCIAL_ID)).toBe(err);
    expect(selectSocials).not.toHaveBeenCalled();
  });

  it("returns 404 when social not found", async () => {
    vi.mocked(selectSocials).mockResolvedValue([]);
    const res = (await validatePostSocialScrapeRequest(makeRequest(), SOCIAL_ID)) as NextResponse;
    expect(res.status).toBe(404);
    expect(checkAccountArtistAccess).not.toHaveBeenCalled();
  });

  it("returns 403 when requester lacks access to owning artist", async () => {
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);
    const res = (await validatePostSocialScrapeRequest(makeRequest(), SOCIAL_ID)) as NextResponse;
    expect(res.status).toBe(403);
    expect(checkAccountArtistAccess).toHaveBeenCalledWith(ACCOUNT_ID, ARTIST_ID);
  });

  it("allows through when social has no linked accounts (auth-only fallback)", async () => {
    vi.mocked(selectAccountSocialsBySocialId).mockResolvedValue([]);
    expect(await validatePostSocialScrapeRequest(makeRequest(), SOCIAL_ID)).toEqual({
      social_id: SOCIAL_ID,
    });
    expect(checkAccountArtistAccess).not.toHaveBeenCalled();
  });

  it("returns validated payload on success", async () => {
    expect(await validatePostSocialScrapeRequest(makeRequest(), SOCIAL_ID)).toEqual({
      social_id: SOCIAL_ID,
    });
  });
});
