import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as scrapeArtist } from "@/app/api/artist/socials/scrape/route";
import { POST as scrapeSocial } from "@/app/api/socials/[id]/scrape/route";
import startTwitterProfileScraping from "@/lib/apify/twitter/startTwitterProfileScraping";
import startYoutubeProfileScraping from "@/lib/apify/youtube/startYoutubeProfileScraping";
import startLinkedinProfileScraping from "@/lib/apify/linkedin/startLinkedinProfileScraping";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { ensureSocialScrapeCredits } from "@/lib/socials/ensureSocialScrapeCredits";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";
import { upsertApifyScraperRuns } from "@/lib/supabase/apify_scraper_runs/upsertApifyScraperRuns";

vi.mock("@/lib/apify/tiktok/startTiktokProfileScraping", () => ({ default: vi.fn() }));
vi.mock("@/lib/apify/instagram/startInstagramProfileScraping", () => ({
  startInstagramProfileScraping: vi.fn(),
}));
vi.mock("@/lib/apify/twitter/startTwitterProfileScraping", () => ({ default: vi.fn() }));
vi.mock("@/lib/apify/threads/startThreadsProfileScraping", () => ({ default: vi.fn() }));
vi.mock("@/lib/apify/youtube/startYoutubeProfileScraping", () => ({ default: vi.fn() }));
vi.mock("@/lib/apify/facebook/startFacebookProfileScraping", () => ({ default: vi.fn() }));
vi.mock("@/lib/apify/linkedin/startLinkedinProfileScraping", () => ({ default: vi.fn() }));
vi.mock("@/lib/supabase/socials/selectSocials", () => ({ selectSocials: vi.fn() }));
vi.mock("@/lib/supabase/account_socials/selectAccountSocials", () => ({
  selectAccountSocials: vi.fn(),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({ checkAccountArtistAccess: vi.fn() }));
vi.mock("@/lib/socials/ensureSocialScrapeCredits", () => ({ ensureSocialScrapeCredits: vi.fn() }));
vi.mock("@/lib/credits/recordCreditDeduction", () => ({ recordCreditDeduction: vi.fn() }));
vi.mock("@/lib/supabase/apify_scraper_runs/upsertApifyScraperRuns", () => ({
  upsertApifyScraperRuns: vi.fn(),
}));

const ACCOUNT_ID = "770e8400-e29b-41d4-a716-446655440000";
const ARTIST_ID = "660e8400-e29b-41d4-a716-446655440000";
const SOCIAL_ID = "550e8400-e29b-41d4-a716-446655440000";
const social = { id: SOCIAL_ID, profile_url: "https://x.com/a", username: "a" };

describe("social scrape route billing with fixture providers and accounts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT_ID,
      authToken: "fixture-token",
      orgId: null,
    });
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(ensureSocialScrapeCredits).mockResolvedValue(null);
    vi.mocked(selectSocials).mockResolvedValue([social as never]);
    vi.mocked(selectAccountSocials).mockResolvedValue([
      { account_id: ARTIST_ID, social },
      {
        account_id: ARTIST_ID,
        social: { id: "youtube", profile_url: "https://youtube.com/@b", username: "b" },
      },
      {
        account_id: ARTIST_ID,
        social: { id: "linkedin", profile_url: "https://linkedin.com/in/c", username: "c" },
      },
    ] as never);
    vi.mocked(startTwitterProfileScraping).mockResolvedValue({ runId: "r1", datasetId: "d1" });
    vi.mocked(startYoutubeProfileScraping).mockResolvedValue({ runId: "r2", datasetId: "d2" });
    vi.mocked(startLinkedinProfileScraping).mockResolvedValue(null);
    vi.mocked(upsertApifyScraperRuns).mockResolvedValue({ data: null, error: null });
  });

  it("POST /api/artist/socials/scrape debits and persists only started runs", async () => {
    const response = await scrapeArtist(
      new NextRequest("http://localhost/api/artist/socials/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": "fixture-key" },
        body: JSON.stringify({ artist_account_id: ARTIST_ID, posts: 20 }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { runId: "r1", datasetId: "d1", error: null },
      { runId: "r2", datasetId: "d2", error: null },
      { runId: null, datasetId: null, error: "Failed to start scrape" },
    ]);
    expect(ensureSocialScrapeCredits).toHaveBeenCalledWith(ACCOUNT_ID, 750_000);
    expect(recordCreditDeduction).toHaveBeenCalledExactlyOnceWith({
      accountId: ACCOUNT_ID,
      creditsToDeduct: 500_000,
      source: "api",
      modelId: "POST /api/artist/socials/scrape",
    });
    expect(upsertApifyScraperRuns).toHaveBeenCalledExactlyOnceWith([
      {
        run_id: "r1",
        account_id: ACCOUNT_ID,
        social_id: SOCIAL_ID,
        platform: "twitter",
        batch_id: expect.any(String),
        origin: "artist",
      },
      {
        run_id: "r2",
        account_id: ACCOUNT_ID,
        social_id: "youtube",
        platform: "youtube",
        batch_id: expect.any(String),
        origin: "artist",
      },
    ]);
    const [runs] = vi.mocked(upsertApifyScraperRuns).mock.calls[0];
    expect(runs[0].batch_id).toBe(runs[1].batch_id);
  });

  it("POST /api/artist/socials/scrape does not bill or persist an all-failed batch", async () => {
    vi.mocked(startTwitterProfileScraping).mockResolvedValue(null);
    vi.mocked(startYoutubeProfileScraping).mockRejectedValue(new Error("Provider unavailable"));
    const response = await scrapeArtist(
      new NextRequest("http://localhost/api/artist/socials/scrape", {
        method: "POST",
        body: JSON.stringify({ artist_account_id: ARTIST_ID }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { runId: null, datasetId: null, error: "Failed to start scrape" },
      { runId: null, datasetId: null, error: "Provider unavailable" },
      { runId: null, datasetId: null, error: "Failed to start scrape" },
    ]);
    expect(recordCreditDeduction).not.toHaveBeenCalled();
    expect(upsertApifyScraperRuns).not.toHaveBeenCalled();
  });

  it("POST /api/socials/{id}/scrape preserves the single-profile response and debit", async () => {
    const response = await scrapeSocial(
      new NextRequest(`http://localhost/api/socials/${SOCIAL_ID}/scrape?posts=20`, {
        method: "POST",
        headers: { "x-api-key": "fixture-key" },
      }),
      { params: Promise.resolve({ id: SOCIAL_ID }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ runId: "r1", datasetId: "d1" });
    expect(startTwitterProfileScraping).toHaveBeenCalledExactlyOnceWith("a", 20, {
      origin: "artist",
    });
    expect(recordCreditDeduction).toHaveBeenCalledExactlyOnceWith({
      accountId: ACCOUNT_ID,
      creditsToDeduct: 250_000,
      source: "api",
      modelId: "POST /api/socials/[id]/scrape",
    });
    expect(upsertApifyScraperRuns).toHaveBeenCalledExactlyOnceWith([
      {
        run_id: "r1",
        account_id: ACCOUNT_ID,
        social_id: SOCIAL_ID,
        platform: "twitter",
        origin: "artist",
      },
    ]);
  });

  it("POST /api/socials/{id}/scrape returns failure without a debit or persisted run", async () => {
    vi.mocked(startTwitterProfileScraping).mockRejectedValue(new Error("Provider unavailable"));
    const response = await scrapeSocial(
      new NextRequest(`http://localhost/api/socials/${SOCIAL_ID}/scrape`, { method: "POST" }),
      { params: Promise.resolve({ id: SOCIAL_ID }) },
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ status: "error", error: "Provider unavailable" });
    expect(recordCreditDeduction).not.toHaveBeenCalled();
    expect(upsertApifyScraperRuns).not.toHaveBeenCalled();
  });
});
