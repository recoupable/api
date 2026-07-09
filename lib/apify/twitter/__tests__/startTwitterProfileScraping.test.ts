import { describe, it, expect, vi, beforeEach } from "vitest";
import apifyClient from "@/lib/apify/client";
import startTwitterProfileScraping from "@/lib/apify/twitter/startTwitterProfileScraping";

const start = vi.fn();
vi.mock("@/lib/apify/client", () => ({ default: { actor: vi.fn(() => ({ start })) } }));

beforeEach(() => {
  vi.clearAllMocks();
  start.mockResolvedValue({ id: "run-1", defaultDatasetId: "ds-1", status: "RUNNING" });
});

describe("startTwitterProfileScraping", () => {
  it("defaults to a 10-item fetch when posts is omitted — retweets/replies are filtered AFTER the fetch, so depth 1 would rarely surface an authored post", async () => {
    const r = await startTwitterProfileScraping("sweetman_eth");
    expect(apifyClient.actor).toHaveBeenCalledWith("apidojo/twitter-scraper-lite");
    expect(start).toHaveBeenCalledWith(
      { twitterHandles: ["sweetman_eth"], sort: "Latest", maxItems: 10 },
      { webhooks: expect.any(Array) },
    );
    expect(r).toEqual({ runId: "run-1", datasetId: "ds-1" });
  });

  it("passes posts through as maxItems", async () => {
    await startTwitterProfileScraping("sweetman_eth", 20);
    expect(start).toHaveBeenCalledWith(
      { twitterHandles: ["sweetman_eth"], sort: "Latest", maxItems: 20 },
      { webhooks: expect.any(Array) },
    );
  });

  it("throws on an empty handle", async () => {
    await expect(startTwitterProfileScraping("  ")).rejects.toThrow(/Invalid Twitter handle/);
    expect(start).not.toHaveBeenCalled();
  });
});
