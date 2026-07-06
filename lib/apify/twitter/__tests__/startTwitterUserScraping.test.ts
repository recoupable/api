import { describe, it, expect, vi, beforeEach } from "vitest";
import apifyClient from "@/lib/apify/client";
import startTwitterUserScraping from "@/lib/apify/twitter/startTwitterUserScraping";

const start = vi.fn();
vi.mock("@/lib/apify/client", () => ({ default: { actor: vi.fn(() => ({ start })) } }));

beforeEach(() => {
  vi.clearAllMocks();
  start.mockResolvedValue({ id: "run-u1", defaultDatasetId: "ds-u1", status: "RUNNING" });
});

describe("startTwitterUserScraping", () => {
  it("starts the profile-level user scraper for one handle", async () => {
    const r = await startTwitterUserScraping("KETTAMA_");
    expect(apifyClient.actor).toHaveBeenCalledWith("apidojo/twitter-user-scraper");
    expect(start).toHaveBeenCalledWith(
      { twitterHandles: ["KETTAMA_"], maxItems: 1 },
      { webhooks: expect.any(Array) },
    );
    expect(r).toEqual({ runId: "run-u1", datasetId: "ds-u1" });
  });

  it("throws on an empty handle", async () => {
    await expect(startTwitterUserScraping("  ")).rejects.toThrow(/Invalid Twitter handle/);
    expect(start).not.toHaveBeenCalled();
  });
});
