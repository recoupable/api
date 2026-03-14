import startTikTokProfileScraping from "@/lib/apify/tiktok/startTiktokProfileScraping";
import startInstagramProfileScraping from "@/lib/apify/instagram/startInstagramProfileScraping";
import startTwitterProfileScraping from "@/lib/apify/twitter/startTwitterProfileScraping";
import startThreadsProfileScraping from "@/lib/apify/threads/startThreadsProfileScraping";
import startYoutubeProfileScraping from "@/lib/apify/youtube/startYoutubeProfileScraping";
import startFacebookProfileScraping from "@/lib/apify/facebook/startFacebookProfileScraping";
import { getUsernameFromProfileUrl } from "@/lib/socials/getUsernameFromProfileUrl";

type ScrapeRunner = (handle: string) => Promise<{
  runId: string;
  datasetId: string;
  error?: string;
  data?: unknown;
} | null>;

export interface ProfileScrapeResult {
  runId: string | null;
  datasetId: string | null;
  error: string | null;
}

export type ScrapeProfileResult = ProfileScrapeResult & {
  supported: boolean;
};

const PLATFORM_SCRAPERS: Array<{
  match: (url: string) => boolean;
  scraper: ScrapeRunner;
}> = [
  {
    match: (url: string) => url.includes("tiktok.com"),
    scraper: startTikTokProfileScraping,
  },
  {
    match: (url: string) => url.includes("instagram.com"),
    scraper: startInstagramProfileScraping,
  },
  {
    match: (url: string) => url.includes("twitter.com") || url.includes("x.com"),
    scraper: startTwitterProfileScraping,
  },
  {
    match: (url: string) => url.includes("threads.com") || url.includes("threads.net"),
    scraper: startThreadsProfileScraping,
  },
  {
    match: (url: string) => url.includes("youtube.com"),
    scraper: startYoutubeProfileScraping,
  },
  {
    match: (url: string) => url.includes("facebook.com"),
    scraper: startFacebookProfileScraping,
  },
];

export const scrapeProfileUrl = async (
  profileUrl: string | null | undefined,
  username: string,
): Promise<ScrapeProfileResult | null> => {
  if (!profileUrl) {
    return null;
  }

  const normalizedUrl = profileUrl.toLowerCase();
  const platform = PLATFORM_SCRAPERS.find(entry => entry.match(normalizedUrl));

  if (!platform) {
    return null;
  }

  const finalUsername = username || getUsernameFromProfileUrl(profileUrl);

  try {
    const result = await platform.scraper(finalUsername);

    if (!result) {
      return {
        runId: null,
        datasetId: null,
        error: "Failed to start scrape",
        supported: true,
      };
    }

    return {
      runId: result.runId ?? null,
      datasetId: result.datasetId ?? null,
      error: result.error ?? null,
      supported: true,
    };
  } catch (error) {
    return {
      runId: null,
      datasetId: null,
      error: error instanceof Error ? error.message : "Failed to start scrape",
      supported: true,
    };
  }
};
