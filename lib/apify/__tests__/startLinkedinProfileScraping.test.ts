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
    expect(start).toHaveBeenCalledWith({ urls: ["https://www.linkedin.com/in/sweetmaneth"] });
    expect(r).toEqual({ runId: "run-1", datasetId: "ds-1" });
  });

  it("passes a full profile URL through unchanged", async () => {
    await startLinkedinProfileScraping("https://www.linkedin.com/in/drew-thurlow");
    expect(start).toHaveBeenCalledWith({ urls: ["https://www.linkedin.com/in/drew-thurlow"] });
  });
});
