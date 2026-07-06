import { describe, it, expect, vi, beforeEach } from "vitest";
import { completeApifyScraperRun } from "@/lib/supabase/apify_scraper_runs/completeApifyScraperRun";
import { maybeSendScrapeDigest } from "@/lib/apify/digest/maybeSendScrapeDigest";
import { NextRequest } from "next/server";
import { apifyWebhookHandler } from "../apifyWebhookHandler";
import { handleInstagramProfileScraperResults } from "../instagram/handleInstagramProfileScraperResults";
import { handleInstagramCommentsScraper } from "../instagram/handleInstagramCommentsScraper";

vi.mock("../instagram/handleInstagramProfileScraperResults", () => ({
  handleInstagramProfileScraperResults: vi.fn(),
}));
vi.mock("../instagram/handleInstagramCommentsScraper", () => ({
  handleInstagramCommentsScraper: vi.fn(),
}));
vi.mock("../linkedin/handleLinkedinProfileScraperResults", () => ({
  handleLinkedinProfileScraperResults: vi.fn(),
}));
vi.mock("../tiktok/handleTiktokProfileScraperResults", () => ({
  handleTiktokProfileScraperResults: vi.fn(),
}));
vi.mock("../twitter/handleTwitterProfileScraperResults", () => ({
  handleTwitterProfileScraperResults: vi.fn(),
}));
vi.mock("../youtube/handleYoutubeProfileScraperResults", () => ({
  handleYoutubeProfileScraperResults: vi.fn(),
}));
vi.mock("../threads/handleThreadsProfileScraperResults", () => ({
  handleThreadsProfileScraperResults: vi.fn(),
}));
vi.mock("../facebook/handleFacebookProfileScraperResults", () => ({
  handleFacebookProfileScraperResults: vi.fn(),
}));

function makeRequest(body: unknown, raw?: string) {
  return new NextRequest("http://localhost/api/apify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });
}

const baseBody = {
  userId: "u",
  createdAt: "2026-01-01T00:00:00Z",
  eventType: "ACTOR.RUN.SUCCEEDED",
  resource: { defaultDatasetId: "ds_1" },
};

vi.mock("@/lib/supabase/apify_scraper_runs/completeApifyScraperRun", () => ({
  completeApifyScraperRun: vi.fn(async () => null),
}));
vi.mock("@/lib/apify/digest/maybeSendScrapeDigest", () => ({
  maybeSendScrapeDigest: vi.fn(async () => null),
}));

describe("apifyWebhookHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dispatches profile scraper results for the IG profile actor", async () => {
    vi.mocked(handleInstagramProfileScraperResults).mockResolvedValue({ posts: [1, 2] } as never);

    const res = await apifyWebhookHandler(
      makeRequest({ ...baseBody, eventData: { actorId: "dSCLg0C3YEZ83HzYX" } }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ posts: [1, 2] });
    expect(handleInstagramProfileScraperResults).toHaveBeenCalledOnce();
    expect(handleInstagramCommentsScraper).not.toHaveBeenCalled();
  });

  it("records batch completion + triggers the digest check when the payload carries a run id (chat#1855)", async () => {
    vi.mocked(handleInstagramProfileScraperResults).mockResolvedValue({
      posts: [],
      newPostUrls: ["https://instagram.com/p/new1"],
    } as never);
    vi.mocked(completeApifyScraperRun).mockResolvedValue({
      run_id: "run-9",
      batch_id: "batch-7",
    } as never);

    const res = await apifyWebhookHandler(
      makeRequest({
        ...baseBody,
        eventData: { actorId: "dSCLg0C3YEZ83HzYX" },
        resource: { ...baseBody.resource, id: "run-9" },
      }),
    );

    expect(res.status).toBe(200);
    expect(completeApifyScraperRun).toHaveBeenCalledWith("run-9", ["https://instagram.com/p/new1"]);
    expect(maybeSendScrapeDigest).toHaveBeenCalledWith("batch-7");
  });

  it("skips digest bookkeeping when the payload has no run id", async () => {
    vi.mocked(handleInstagramProfileScraperResults).mockResolvedValue({ posts: [] } as never);
    await apifyWebhookHandler(
      makeRequest({ ...baseBody, eventData: { actorId: "dSCLg0C3YEZ83HzYX" } }),
    );
    expect(completeApifyScraperRun).not.toHaveBeenCalled();
    expect(maybeSendScrapeDigest).not.toHaveBeenCalled();
  });

  it("dispatches comments scraper for the IG comments actor", async () => {
    vi.mocked(handleInstagramCommentsScraper).mockResolvedValue({
      comments: [],
      processedPostUrls: ["u1", "u2"],
    } as never);

    const res = await apifyWebhookHandler(
      makeRequest({ ...baseBody, eventData: { actorId: "SbK00X0JYCPblD2wp" } }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ comments: [], processedPostUrls: ["u1", "u2"] });
    expect(handleInstagramCommentsScraper).toHaveBeenCalledOnce();
    expect(handleInstagramProfileScraperResults).not.toHaveBeenCalled();
  });

  it("returns a 200 error response for unhandled actor ids", async () => {
    const res = await apifyWebhookHandler(
      makeRequest({ ...baseBody, eventData: { actorId: "unknown_actor" } }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("error");
    expect(body.error).toContain("unknown_actor");
    expect(handleInstagramProfileScraperResults).not.toHaveBeenCalled();
    expect(handleInstagramCommentsScraper).not.toHaveBeenCalled();
  });

  it("returns a 200 error response when the dispatched handler throws", async () => {
    vi.mocked(handleInstagramProfileScraperResults).mockRejectedValue(new Error("boom"));

    const res = await apifyWebhookHandler(
      makeRequest({ ...baseBody, eventData: { actorId: "dSCLg0C3YEZ83HzYX" } }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "error", error: "Internal server error" });
  });

  it("propagates the validator's error response for invalid payloads", async () => {
    const res = await apifyWebhookHandler(makeRequest({ bogus: true }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("error");
    expect(typeof body.error).toBe("string");
    expect(handleInstagramProfileScraperResults).not.toHaveBeenCalled();
    expect(handleInstagramCommentsScraper).not.toHaveBeenCalled();
  });

  it("propagates the validator's Invalid JSON response for malformed bodies", async () => {
    const res = await apifyWebhookHandler(makeRequest(null, "not json"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "error", error: "Invalid JSON" });
  });
});
