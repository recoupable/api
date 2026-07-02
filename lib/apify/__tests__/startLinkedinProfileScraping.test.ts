import { describe, it, expect, vi, beforeEach } from "vitest";
import apifyClient from "@/lib/apify/client";
import startLinkedinProfileScraping from "@/lib/apify/linkedin/startLinkedinProfileScraping";

const start = vi.fn();
vi.mock("@/lib/apify/client", () => ({ default: { actor: vi.fn(() => ({ start })) } }));

beforeEach(() => {
  vi.clearAllMocks();
  start.mockResolvedValue({ id: "run-1", defaultDatasetId: "ds-1", status: "RUNNING" });
});

describe("startLinkedinProfileScraping", () => {
  it("starts the harvestapi actor with `urls` (the actor's real input key), building the /in/ URL from a handle", async () => {
    const r = await startLinkedinProfileScraping("sweetmaneth");
    expect(apifyClient.actor).toHaveBeenCalledWith("harvestapi/linkedin-profile-scraper");
    expect(start).toHaveBeenCalledWith(
      { urls: ["https://www.linkedin.com/in/sweetmaneth"] },
      { webhooks: expect.any(Array) },
    );
    expect(r).toEqual({ runId: "run-1", datasetId: "ds-1" });
  });

  it("passes a full profile URL through unchanged", async () => {
    await startLinkedinProfileScraping("https://www.linkedin.com/in/drew-thurlow");
    expect(start).toHaveBeenCalledWith(
      { urls: ["https://www.linkedin.com/in/drew-thurlow"] },
      { webhooks: expect.any(Array) },
    );
  });
  it("rejects LinkedIn path prefixes as handles (legacy rows stored 'in') instead of scraping the wrong profile", async () => {
    await expect(startLinkedinProfileScraping("in")).rejects.toThrow(/Invalid LinkedIn handle/);
    await expect(startLinkedinProfileScraping("company")).rejects.toThrow(
      /Invalid LinkedIn handle/,
    );
    expect(start).not.toHaveBeenCalled();
  });

  it("runs the posts actor with maxPosts when a posts depth is requested", async () => {
    const r = await startLinkedinProfileScraping("sweetmaneth", 20);
    expect(apifyClient.actor).toHaveBeenCalledWith("harvestapi/linkedin-profile-posts");
    expect(start).toHaveBeenCalledWith(
      { targetUrls: ["https://www.linkedin.com/in/sweetmaneth"], maxPosts: 20 },
      { webhooks: expect.any(Array) },
    );
    expect(r).toEqual({ runId: "run-1", datasetId: "ds-1" });
  });

  it("posts depth keeps the full-URL passthrough and the handle guards", async () => {
    await startLinkedinProfileScraping("https://www.linkedin.com/in/drew-thurlow", 5);
    expect(start).toHaveBeenCalledWith(
      { targetUrls: ["https://www.linkedin.com/in/drew-thurlow"], maxPosts: 5 },
      { webhooks: expect.any(Array) },
    );
    await expect(startLinkedinProfileScraping("in", 5)).rejects.toThrow(/Invalid LinkedIn handle/);
  });

  it("posts omitted keeps the legacy profile actor and input byte-identical", async () => {
    await startLinkedinProfileScraping("sweetmaneth", undefined);
    expect(apifyClient.actor).toHaveBeenCalledWith("harvestapi/linkedin-profile-scraper");
    expect(start).toHaveBeenCalledWith(
      { urls: ["https://www.linkedin.com/in/sweetmaneth"] },
      { webhooks: expect.any(Array) },
    );
  });
});
