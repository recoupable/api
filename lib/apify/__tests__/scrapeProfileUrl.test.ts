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
    expect(li).toHaveBeenCalledWith("drew-thurlow", undefined, { origin: "artist" });
    expect(r).toMatchObject({ supported: true, runId: "li-run", datasetId: "li-ds" });
  });
  it("forwards posts to the platform scraper", async () => {
    await scrapeProfileUrl("https://www.linkedin.com/in/drew-thurlow", "drew-thurlow", 20);
    expect(li).toHaveBeenCalledWith("drew-thurlow", 20, { origin: "artist" });
  });
  it("returns null for an unsupported platform (spotify)", async () => {
    const r = await scrapeProfileUrl("https://open.spotify.com/artist/x", "x");
    expect(r).toBeNull();
    expect(li).not.toHaveBeenCalled();
  });
  it("passes options through to the YouTube scraper", async () => {
    const yt = (await import("@/lib/apify/youtube/startYoutubeProfileScraping"))
      .default as unknown as ReturnType<typeof vi.fn>;
    yt.mockResolvedValue({ runId: "yt-run", datasetId: "yt-ds" });
    const r = await scrapeProfileUrl("https://www.youtube.com/@mycowtf", "mycowtf", 10, {
      subtitles: true,
    });
    expect(yt).toHaveBeenCalledWith("mycowtf", 10, { origin: "artist" }, { subtitles: true });
    expect(r).toMatchObject({ runId: "yt-run", datasetId: "yt-ds", supported: true });
  });
});
