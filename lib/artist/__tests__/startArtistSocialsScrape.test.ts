import { describe, it, expect, vi, beforeEach } from "vitest";
import { startArtistSocialsScrape } from "../startArtistSocialsScrape";
import { scrapeProfileUrlBatch } from "@/lib/apify/scrapeProfileUrlBatch";
import { deductSocialScrapeCredits } from "@/lib/socials/deductSocialScrapeCredits";
import { upsertApifyScraperRuns } from "@/lib/supabase/apify_scraper_runs/upsertApifyScraperRuns";

vi.mock("@/lib/apify/scrapeProfileUrlBatch", () => ({ scrapeProfileUrlBatch: vi.fn() }));
vi.mock("@/lib/socials/deductSocialScrapeCredits", () => ({ deductSocialScrapeCredits: vi.fn() }));
vi.mock("@/lib/supabase/apify_scraper_runs/upsertApifyScraperRuns", () => ({
  upsertApifyScraperRuns: vi.fn(),
}));

const SOCIALS = [
  { social: { id: "s1", profile_url: "https://x.com/a", username: "a" } },
  { social: { id: "s2", profile_url: "https://www.youtube.com/@b", username: "b" } },
] as never;

describe("startArtistSocialsScrape", () => {
  beforeEach(() => vi.clearAllMocks());

  it("charges and registers only the runs that started", async () => {
    vi.mocked(scrapeProfileUrlBatch).mockResolvedValue([
      {
        state: "started",
        runId: "r1",
        datasetId: "d1",
        error: null,
        profileUrl: "https://x.com/a",
      },
      { state: "failed", runId: null, datasetId: null, error: "boom", profileUrl: null },
    ]);

    const results = await startArtistSocialsScrape({
      accountId: "acct",
      socials: SOCIALS,
      posts: 3,
      costPerProfile: 80_000,
      modelId: "POST /api/artist/socials/scrape",
    });

    expect(scrapeProfileUrlBatch).toHaveBeenCalledWith(
      [
        { profileUrl: "https://x.com/a", username: "a" },
        { profileUrl: "https://www.youtube.com/@b", username: "b" },
      ],
      3,
    );
    expect(deductSocialScrapeCredits).toHaveBeenCalledWith(
      "acct",
      80_000,
      "POST /api/artist/socials/scrape",
    );
    const [runs] = vi.mocked(upsertApifyScraperRuns).mock.calls[0];
    expect(runs).toEqual([
      expect.objectContaining({
        run_id: "r1",
        account_id: "acct",
        social_id: "s1",
        platform: "twitter",
        origin: "artist",
      }),
    ]);
    expect(results).toEqual([
      { runId: "r1", datasetId: "d1", error: null },
      { runId: null, datasetId: null, error: "boom" },
    ]);
  });

  it("charges nothing when no scrape started", async () => {
    vi.mocked(scrapeProfileUrlBatch).mockResolvedValue([
      { state: "failed", runId: null, datasetId: null, error: "boom", profileUrl: null },
    ]);
    await startArtistSocialsScrape({
      accountId: "acct",
      socials: SOCIALS,
      costPerProfile: 50_000,
      modelId: "x",
    });
    expect(deductSocialScrapeCredits).not.toHaveBeenCalled();
    expect(upsertApifyScraperRuns).not.toHaveBeenCalled();
  });
});
