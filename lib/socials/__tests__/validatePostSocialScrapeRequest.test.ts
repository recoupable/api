import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validatePostSocialScrapeRequest } from "../validatePostSocialScrapeRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { ensureSocialScrapeCredits } from "../ensureSocialScrapeCredits";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/socials/selectSocials", () => ({ selectSocials: vi.fn() }));
vi.mock("@/lib/supabase/account_socials/selectAccountSocials", () => ({
  selectAccountSocials: vi.fn(),
}));
vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: vi.fn(),
}));
vi.mock("../ensureSocialScrapeCredits", () => ({ ensureSocialScrapeCredits: vi.fn() }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const SOCIAL_ID = "550e8400-e29b-41d4-a716-446655440000";
const ACCOUNT_ID = "770e8400-e29b-41d4-a716-446655440000";
const ARTIST_ID = "660e8400-e29b-41d4-a716-446655440000";
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
    vi.mocked(selectAccountSocials).mockResolvedValue([{ account_id: ARTIST_ID } as never]);
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(ensureSocialScrapeCredits).mockResolvedValue(null);
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
    expect(selectAccountSocials).not.toHaveBeenCalled();
  });

  it("returns 403 when social has no owning artist accounts", async () => {
    vi.mocked(selectAccountSocials).mockResolvedValue([]);
    const res = (await validatePostSocialScrapeRequest(makeRequest(), SOCIAL_ID)) as NextResponse;
    expect(res.status).toBe(403);
    expect(checkAccountArtistAccess).not.toHaveBeenCalled();
  });

  it("returns 403 when caller has no access to any owning artist", async () => {
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);
    const res = (await validatePostSocialScrapeRequest(makeRequest(), SOCIAL_ID)) as NextResponse;
    expect(res.status).toBe(403);
    expect(checkAccountArtistAccess).toHaveBeenCalledWith(ACCOUNT_ID, ARTIST_ID);
  });

  it("returns validated payload when caller has access to an owning artist", async () => {
    expect(await validatePostSocialScrapeRequest(makeRequest(), SOCIAL_ID)).toEqual({
      social_id: SOCIAL_ID,
      posts: undefined,
      account_id: ACCOUNT_ID,
    });
    expect(ensureSocialScrapeCredits).toHaveBeenCalledWith(ACCOUNT_ID, 5);
  });

  it("parses a valid posts query param and gates on 5 + posts credits", async () => {
    const req = new NextRequest(`http://localhost/api/socials/${SOCIAL_ID}/scrape?posts=20`, {
      method: "POST",
      headers: { "x-api-key": "k" },
    });
    expect(await validatePostSocialScrapeRequest(req, SOCIAL_ID)).toEqual({
      social_id: SOCIAL_ID,
      posts: 20,
      account_id: ACCOUNT_ID,
    });
    expect(ensureSocialScrapeCredits).toHaveBeenCalledWith(ACCOUNT_ID, 25);
  });

  it("short-circuits with the 402 when credits are insufficient", async () => {
    const short = NextResponse.json({}, { status: 402 });
    vi.mocked(ensureSocialScrapeCredits).mockResolvedValue(short);
    expect(await validatePostSocialScrapeRequest(makeRequest(), SOCIAL_ID)).toBe(short);
  });

  it.each([["0"], ["101"], ["abc"], ["1.5"]])(
    "returns 400 for invalid posts query param %s",
    async posts => {
      const req = new NextRequest(
        `http://localhost/api/socials/${SOCIAL_ID}/scrape?posts=${posts}`,
        { method: "POST", headers: { "x-api-key": "k" } },
      );
      const res = (await validatePostSocialScrapeRequest(req, SOCIAL_ID)) as NextResponse;
      expect(res.status).toBe(400);
      expect(validateAuthContext).not.toHaveBeenCalled();
    },
  );

  it("propagates DB error from selectAccountSocials (fails closed as 500)", async () => {
    vi.mocked(selectAccountSocials).mockRejectedValue(new Error("db blew up"));
    await expect(validatePostSocialScrapeRequest(makeRequest(), SOCIAL_ID)).rejects.toThrow(
      "db blew up",
    );
  });
});
