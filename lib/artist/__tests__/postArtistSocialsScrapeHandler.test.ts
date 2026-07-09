import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { postArtistSocialsScrapeHandler } from "../postArtistSocialsScrapeHandler";
import { scrapeProfileUrlBatch } from "@/lib/apify/scrapeProfileUrlBatch";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { ensureSocialScrapeCredits } from "@/lib/socials/ensureSocialScrapeCredits";
import { deductSocialScrapeCredits } from "@/lib/socials/deductSocialScrapeCredits";

vi.mock("@/lib/supabase/apify_scraper_runs/upsertApifyScraperRuns", () => ({
  upsertApifyScraperRuns: vi.fn(async () => ({ data: null, error: null })),
}));
vi.mock("@/lib/apify/scrapeProfileUrlBatch", () => ({ scrapeProfileUrlBatch: vi.fn() }));
vi.mock("@/lib/supabase/account_socials/selectAccountSocials", () => ({
  selectAccountSocials: vi.fn(),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({ checkAccountArtistAccess: vi.fn() }));
vi.mock("@/lib/socials/ensureSocialScrapeCredits", () => ({ ensureSocialScrapeCredits: vi.fn() }));
vi.mock("@/lib/socials/deductSocialScrapeCredits", () => ({ deductSocialScrapeCredits: vi.fn() }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const ARTIST_ID = "660e8400-e29b-41d4-a716-446655440000";
const ACCOUNT_ID = "770e8400-e29b-41d4-a716-446655440000";
const authResult = { accountId: ACCOUNT_ID, authToken: "t", orgId: null };

const TWO_SOCIALS = [
  { social: { profile_url: "https://x.com/a", username: "a" } },
  { social: { profile_url: "https://youtube.com/@b", username: "b" } },
];

const makeRequest = (body: unknown) =>
  new NextRequest("http://localhost/api/artist/socials/scrape", {
    method: "POST",
    body: JSON.stringify(body),
  });

describe("postArtistSocialsScrapeHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue(authResult);
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(ensureSocialScrapeCredits).mockResolvedValue(null);
    vi.mocked(selectAccountSocials).mockResolvedValue(TWO_SOCIALS as never);
    vi.mocked(scrapeProfileUrlBatch).mockResolvedValue([
      { runId: "r1", datasetId: "d1", error: null, profileUrl: null },
      { runId: "r2", datasetId: "d2", error: null, profileUrl: null },
    ]);
  });

  it("returns 400 when artist_account_id is missing", async () => {
    const res = await postArtistSocialsScrapeHandler(makeRequest({}));
    expect(res.status).toBe(400);
    expect(scrapeProfileUrlBatch).not.toHaveBeenCalled();
  });

  it("propagates the auth error (endpoint is no longer open)", async () => {
    const err = NextResponse.json({}, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(err);
    expect(
      await postArtistSocialsScrapeHandler(makeRequest({ artist_account_id: ARTIST_ID })),
    ).toBe(err);
    expect(selectAccountSocials).not.toHaveBeenCalled();
    expect(scrapeProfileUrlBatch).not.toHaveBeenCalled();
  });

  it("returns 403 when the caller has no access to the artist", async () => {
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);
    const res = await postArtistSocialsScrapeHandler(makeRequest({ artist_account_id: ARTIST_ID }));
    expect(res.status).toBe(403);
    expect(checkAccountArtistAccess).toHaveBeenCalledWith(ACCOUNT_ID, ARTIST_ID);
    expect(scrapeProfileUrlBatch).not.toHaveBeenCalled();
  });

  it("gates on (5 + posts) × profiles credits and short-circuits with the 402", async () => {
    const short = NextResponse.json({}, { status: 402 });
    vi.mocked(ensureSocialScrapeCredits).mockResolvedValue(short);
    expect(
      await postArtistSocialsScrapeHandler(
        makeRequest({ artist_account_id: ARTIST_ID, posts: 20 }),
      ),
    ).toBe(short);
    expect(ensureSocialScrapeCredits).toHaveBeenCalledWith(ACCOUNT_ID, 50);
    expect(scrapeProfileUrlBatch).not.toHaveBeenCalled();
  });

  it("scrapes without a posts depth by default and deducts 5 credits per scraped profile", async () => {
    const res = await postArtistSocialsScrapeHandler(makeRequest({ artist_account_id: ARTIST_ID }));
    expect(res.status).toBe(200);
    expect(ensureSocialScrapeCredits).toHaveBeenCalledWith(ACCOUNT_ID, 10);
    expect(scrapeProfileUrlBatch).toHaveBeenCalledWith(
      [
        { profileUrl: "https://x.com/a", username: "a" },
        { profileUrl: "https://youtube.com/@b", username: "b" },
      ],
      undefined,
    );
    expect(deductSocialScrapeCredits).toHaveBeenCalledWith(ACCOUNT_ID, 10);
  });

  it("forwards posts and deducts (5 + posts) per profile actually scraped", async () => {
    vi.mocked(scrapeProfileUrlBatch).mockResolvedValue([
      { runId: "r1", datasetId: "d1", error: null, profileUrl: null },
    ]);
    await postArtistSocialsScrapeHandler(makeRequest({ artist_account_id: ARTIST_ID, posts: 20 }));
    expect(ensureSocialScrapeCredits).toHaveBeenCalledWith(ACCOUNT_ID, 50);
    expect(scrapeProfileUrlBatch).toHaveBeenCalledWith(expect.any(Array), 20);
    expect(deductSocialScrapeCredits).toHaveBeenCalledWith(ACCOUNT_ID, 25);
  });

  it("returns [] and charges nothing when the artist has no socials", async () => {
    vi.mocked(selectAccountSocials).mockResolvedValue([]);
    const res = await postArtistSocialsScrapeHandler(makeRequest({ artist_account_id: ARTIST_ID }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(ensureSocialScrapeCredits).not.toHaveBeenCalled();
    expect(deductSocialScrapeCredits).not.toHaveBeenCalled();
  });
});
