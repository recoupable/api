import { describe, it, expect, vi, beforeEach } from "vitest";
import apifyClient from "@/lib/apify/client";
import startYoutubeProfileScraping from "@/lib/apify/youtube/startYoutubeProfileScraping";

const start = vi.fn();
vi.mock("@/lib/apify/client", () => ({ default: { actor: vi.fn(() => ({ start })) } }));

beforeEach(() => {
  vi.clearAllMocks();
  start.mockResolvedValue({ id: "run-1", defaultDatasetId: "ds-1", status: "RUNNING" });
});

describe("startYoutubeProfileScraping", () => {
  it("defaults to the legacy snapshot (maxResults: 1, Shorts and streams excluded) when posts is omitted", async () => {
    const r = await startYoutubeProfileScraping("@mycowtf");
    expect(apifyClient.actor).toHaveBeenCalledWith("streamers/youtube-scraper");
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        startUrls: [{ url: "https://www.youtube.com/@mycowtf" }],
        maxResults: 1,
        maxResultsShorts: 0,
        maxResultStreams: 0,
      }),
      { webhooks: expect.any(Array) },
    );
    expect(r).toEqual({ runId: "run-1", datasetId: "ds-1" });
  });

  it("passes posts through as maxResults, maxResultsShorts AND maxResultStreams (Shorts + streams included)", async () => {
    await startYoutubeProfileScraping("mycowtf", 20);
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        startUrls: [{ url: "https://www.youtube.com/@mycowtf" }],
        maxResults: 20,
        maxResultsShorts: 20,
        maxResultStreams: 20,
      }),
      { webhooks: expect.any(Array) },
    );
  });

  it("throws on an empty handle", async () => {
    await expect(startYoutubeProfileScraping("  ")).rejects.toThrow(/Invalid YouTube handle/);
    expect(start).not.toHaveBeenCalled();
  });
});
