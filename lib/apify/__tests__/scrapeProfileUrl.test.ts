import { describe, it, expect, vi, beforeEach } from "vitest";

import { scrapeProfileUrl } from "@/lib/apify/scrapeProfileUrl";

const li = vi.fn();
vi.mock("@/lib/apify/linkedin/startLinkedinProfileScraping", () => ({
  default: (...a: unknown[]) => li(...a),
}));
vi.mock("@/lib/apify/tiktok/startTiktokProfileScraping", () => ({ default: vi.fn() }));
vi.mock("@/lib/apify/instagram/startInstagramProfileScraping", () => ({
  startInstagramProfileScraping: vi.fn(),
}));
vi.mock("@/lib/apify/twitter/startTwitterProfileScraping", () => ({ default: vi.fn() }));
vi.mock("@/lib/apify/threads/startThreadsProfileScraping", () => ({ default: vi.fn() }));
vi.mock("@/lib/apify/youtube/startYoutubeProfileScraping", () => ({ default: vi.fn() }));
vi.mock("@/lib/apify/facebook/startFacebookProfileScraping", () => ({ default: vi.fn() }));
vi.mock("@/lib/socials/getUsernameFromProfileUrl", () => ({
  getUsernameFromProfileUrl: () => "drew-thurlow",
}));

beforeEach(() => {
  vi.clearAllMocks();
  li.mockResolvedValue({ runId: "li-run", datasetId: "li-ds" });
});

describe("scrapeProfileUrl", () => {
  it("dispatches linkedin.com to the LinkedIn scraper", async () => {
    const r = await scrapeProfileUrl("https://www.linkedin.com/in/drew-thurlow", "drew-thurlow");
    expect(li).toHaveBeenCalledWith("drew-thurlow");
    expect(r).toMatchObject({ supported: true, runId: "li-run", datasetId: "li-ds" });
  });
  it("returns null for an unsupported platform (spotify)", async () => {
    const r = await scrapeProfileUrl("https://open.spotify.com/artist/x", "x");
    expect(r).toBeNull();
    expect(li).not.toHaveBeenCalled();
  });
});
