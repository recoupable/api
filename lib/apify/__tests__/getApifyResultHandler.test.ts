import { describe, it, expect, vi } from "vitest";
import { getApifyResultHandler } from "@/lib/apify/getApifyResultHandler";
import { handleInstagramProfileScraperResults } from "@/lib/apify/instagram/handleInstagramProfileScraperResults";
import { handleInstagramCommentsScraper } from "@/lib/apify/instagram/handleInstagramCommentsScraper";
import { handleLinkedinProfileScraperResults } from "@/lib/apify/linkedin/handleLinkedinProfileScraperResults";
import { handleTiktokProfileScraperResults } from "@/lib/apify/tiktok/handleTiktokProfileScraperResults";
import { handleTwitterProfileScraperResults } from "@/lib/apify/twitter/handleTwitterProfileScraperResults";
import { handleYoutubeProfileScraperResults } from "@/lib/apify/youtube/handleYoutubeProfileScraperResults";
import { handleThreadsProfileScraperResults } from "@/lib/apify/threads/handleThreadsProfileScraperResults";
import { handleFacebookProfileScraperResults } from "@/lib/apify/facebook/handleFacebookProfileScraperResults";

vi.mock("@/lib/apify/instagram/handleInstagramProfileScraperResults", () => ({
  handleInstagramProfileScraperResults: vi.fn(),
}));
vi.mock("@/lib/apify/instagram/handleInstagramCommentsScraper", () => ({
  handleInstagramCommentsScraper: vi.fn(),
}));
vi.mock("@/lib/apify/linkedin/handleLinkedinProfileScraperResults", () => ({
  handleLinkedinProfileScraperResults: vi.fn(),
}));
vi.mock("@/lib/apify/tiktok/handleTiktokProfileScraperResults", () => ({
  handleTiktokProfileScraperResults: vi.fn(),
}));
vi.mock("@/lib/apify/twitter/handleTwitterProfileScraperResults", () => ({
  handleTwitterProfileScraperResults: vi.fn(),
}));
vi.mock("@/lib/apify/youtube/handleYoutubeProfileScraperResults", () => ({
  handleYoutubeProfileScraperResults: vi.fn(),
}));
vi.mock("@/lib/apify/threads/handleThreadsProfileScraperResults", () => ({
  handleThreadsProfileScraperResults: vi.fn(),
}));
vi.mock("@/lib/apify/facebook/handleFacebookProfileScraperResults", () => ({
  handleFacebookProfileScraperResults: vi.fn(),
}));

describe("getApifyResultHandler", () => {
  it("maps the Instagram actor ids to their result handlers", () => {
    expect(getApifyResultHandler("dSCLg0C3YEZ83HzYX")).toBe(handleInstagramProfileScraperResults);
    expect(getApifyResultHandler("SbK00X0JYCPblD2wp")).toBe(handleInstagramCommentsScraper);
  });
  it("maps the harvestapi LinkedIn actor id to its results handler", () => {
    expect(getApifyResultHandler("LpVuK3Zozwuipa5bp")).toBe(handleLinkedinProfileScraperResults);
  });
  it("maps every platform's resolved actor id to its results handler", () => {
    expect(getApifyResultHandler("GdWCkxBtKWOsKjdch")).toBe(handleTiktokProfileScraperResults);
    expect(getApifyResultHandler("nfp1fpt5gUlBwPcor")).toBe(handleTwitterProfileScraperResults);
    expect(getApifyResultHandler("h7sDV53CddomktSi5")).toBe(handleYoutubeProfileScraperResults);
    expect(getApifyResultHandler("kJdK90pa2hhYYrCK5")).toBe(handleThreadsProfileScraperResults);
    expect(getApifyResultHandler("4Hv5RhChiaDk6iwad")).toBe(handleFacebookProfileScraperResults);
  });
  it("returns undefined for an unregistered actor id", () => {
    expect(getApifyResultHandler("unknown_actor")).toBeUndefined();
  });
});
