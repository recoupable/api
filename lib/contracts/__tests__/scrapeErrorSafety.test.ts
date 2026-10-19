import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as scrapeBatch } from "@/app/api/artist/socials/scrape/route";
import { POST as scrapeSingle } from "@/app/api/socials/[id]/scrape/route";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { deductSocialScrapeCredits } from "@/lib/socials/deductSocialScrapeCredits";
import startLinkedinProfileScraping from "@/lib/apify/linkedin/startLinkedinProfileScraping";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(async () => ({ accountId: "account" })),
}));
vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: vi.fn(async () => true),
}));
vi.mock("@/lib/socials/validatePostSocialScrapeRequest", () => ({
  validatePostSocialScrapeRequest: vi.fn(async () => ({
    social_id: "social",
    account_id: "account",
  })),
}));
vi.mock("@/lib/socials/ensureSocialScrapeCredits", () => ({
  ensureSocialScrapeCredits: vi.fn(async () => null),
}));
vi.mock("@/lib/socials/deductSocialScrapeCredits", () => ({ deductSocialScrapeCredits: vi.fn() }));
vi.mock("@/lib/supabase/socials/selectSocials", () => ({ selectSocials: vi.fn() }));
vi.mock("@/lib/supabase/account_socials/selectAccountSocials", () => ({
  selectAccountSocials: vi.fn(),
}));
vi.mock("@/lib/supabase/apify_scraper_runs/upsertApifyScraperRuns", () => ({
  upsertApifyScraperRuns: vi.fn(),
}));
vi.mock("@/lib/apify/registerRootApifyRun", () => ({ registerRootApifyRun: vi.fn() }));
vi.mock("@/lib/apify/linkedin/startLinkedinProfileScraping", () => ({ default: vi.fn() }));
vi.mock("@/lib/apify/tiktok/startTiktokProfileScraping", () => ({ default: vi.fn() }));
vi.mock("@/lib/apify/instagram/startInstagramProfileScraping", () => ({
  startInstagramProfileScraping: vi.fn(),
}));
vi.mock("@/lib/apify/twitter/startTwitterProfileScraping", () => ({ default: vi.fn() }));
vi.mock("@/lib/apify/threads/startThreadsProfileScraping", () => ({ default: vi.fn() }));
vi.mock("@/lib/apify/youtube/startYoutubeProfileScraping", () => ({ default: vi.fn() }));
vi.mock("@/lib/apify/facebook/startFacebookProfileScraping", () => ({ default: vi.fn() }));

const canary = "synthetic-internal-canary-7f91";
const social = {
  id: "social",
  profile_url: "https://linkedin.com/in/example",
  username: "example",
};
const routes = [
  {
    name: "batch",
    call: () =>
      scrapeBatch(
        new NextRequest("https://api.example/api/artist/socials/scrape", {
          method: "POST",
          body: JSON.stringify({ artist_account_id: "11111111-1111-4111-8111-111111111111" }),
        }),
      ),
  },
  {
    name: "single",
    call: () =>
      scrapeSingle(
        new NextRequest("https://api.example/api/socials/social/scrape", {
          method: "POST",
        }),
        { params: Promise.resolve({ id: "social" }) },
      ),
  },
];

describe("scrape error safety through actual route exports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(selectSocials).mockResolvedValue([social] as never);
    vi.mocked(selectAccountSocials).mockResolvedValue([{ social }] as never);
  });

  it.each(routes)(
    "$name hides provider exception details without charging",
    async ({ name, call }) => {
      vi.mocked(startLinkedinProfileScraping).mockRejectedValue(new Error(canary));
      const response = await call();
      const body = await response.json();
      expect(response.status).toBe(name === "batch" ? 200 : 500);
      expect(body).toEqual(
        name === "batch"
          ? [{ runId: null, datasetId: null, error: "Failed to start scrape" }]
          : { status: "error", error: "Failed to start scrape" },
      );
      expect(JSON.stringify(body)).not.toContain(canary);
      expect(deductSocialScrapeCredits).not.toHaveBeenCalled();
    },
  );

  it.each(routes)(
    "$name hides unexpected database details without charging",
    async ({ name, call }) => {
      vi.mocked(selectSocials).mockRejectedValue(new Error(canary));
      vi.mocked(selectAccountSocials).mockRejectedValue(new Error(canary));
      const response = await call();
      const body = await response.json();
      expect(response.status).toBe(500);
      expect(body).toEqual({
        status: "error",
        [name === "batch" ? "message" : "error"]: "Internal server error",
      });
      expect(JSON.stringify(body)).not.toContain(canary);
      expect(deductSocialScrapeCredits).not.toHaveBeenCalled();
    },
  );
});
