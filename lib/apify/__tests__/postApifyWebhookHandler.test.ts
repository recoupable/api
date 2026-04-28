import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { postApifyWebhookHandler } from "../postApifyWebhookHandler";
import { handleInstagramProfileScraperResults } from "../instagram/handleInstagramProfileScraperResults";
import { handleInstagramCommentsScraper } from "../instagram/handleInstagramCommentsScraper";

vi.mock("../instagram/handleInstagramProfileScraperResults", () => ({
  handleInstagramProfileScraperResults: vi.fn(),
}));
vi.mock("../instagram/handleInstagramCommentsScraper", () => ({
  handleInstagramCommentsScraper: vi.fn(),
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

describe("postApifyWebhookHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dispatches profile scraper results for the IG profile actor", async () => {
    vi.mocked(handleInstagramProfileScraperResults).mockResolvedValue({ posts: [1, 2] } as never);

    const res = await postApifyWebhookHandler(
      makeRequest({ ...baseBody, eventData: { actorId: "dSCLg0C3YEZ83HzYX" } }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ posts: [1, 2] });
    expect(handleInstagramProfileScraperResults).toHaveBeenCalledOnce();
    expect(handleInstagramCommentsScraper).not.toHaveBeenCalled();
  });

  it("dispatches comments scraper for the IG comments actor", async () => {
    vi.mocked(handleInstagramCommentsScraper).mockResolvedValue({ totalComments: 3 } as never);

    const res = await postApifyWebhookHandler(
      makeRequest({ ...baseBody, eventData: { actorId: "SbK00X0JYCPblD2wp" } }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ totalComments: 3 });
    expect(handleInstagramCommentsScraper).toHaveBeenCalledOnce();
    expect(handleInstagramProfileScraperResults).not.toHaveBeenCalled();
  });

  it("returns a 200 error response for unhandled actor ids", async () => {
    const res = await postApifyWebhookHandler(
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

    const res = await postApifyWebhookHandler(
      makeRequest({ ...baseBody, eventData: { actorId: "dSCLg0C3YEZ83HzYX" } }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "error", error: "boom" });
  });

  it("propagates the validator's error response for invalid payloads", async () => {
    const res = await postApifyWebhookHandler(makeRequest({ bogus: true }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("error");
    expect(typeof body.error).toBe("string");
    expect(handleInstagramProfileScraperResults).not.toHaveBeenCalled();
    expect(handleInstagramCommentsScraper).not.toHaveBeenCalled();
  });

  it("propagates the validator's Invalid JSON response for malformed bodies", async () => {
    const res = await postApifyWebhookHandler(makeRequest(null, "not json"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "error", error: "Invalid JSON" });
  });
});
