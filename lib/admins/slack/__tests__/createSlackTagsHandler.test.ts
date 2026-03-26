import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createSlackTagsHandler } from "../createSlackTagsHandler";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const mockValidate = vi.fn();
const mockFetchMentions = vi.fn();

const handler = createSlackTagsHandler({
  validate: mockValidate,
  fetchMentions: mockFetchMentions,
  responseField: "pull_requests",
  totalField: "total_pull_requests",
  countField: "tags_with_pull_requests",
});

/**
 *
 * @param period
 */
function makeRequest(period = "all") {
  return new NextRequest(`https://example.com/api/admins/coding/slack?period=${period}`);
}

describe("createSlackTagsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with tags, total, and aggregate stats", async () => {
    const mockTags = [
      { user_id: "U1", responses: ["pr1", "pr2"] },
      { user_id: "U2", responses: [] },
    ];
    mockValidate.mockResolvedValue({ period: "all" });
    mockFetchMentions.mockResolvedValue(mockTags);

    const response = await handler(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("success");
    expect(body.total).toBe(2);
    expect(body.total_pull_requests).toBe(2);
    expect(body.tags_with_pull_requests).toBe(1);
    expect(body.tags).toEqual(mockTags);
  });

  it("works with video_links response field config", async () => {
    const videoHandler = createSlackTagsHandler({
      validate: mockValidate,
      fetchMentions: mockFetchMentions,
      responseField: "video_links",
      totalField: "total_videos",
      countField: "tags_with_videos",
    });

    const mockTags = [
      { user_id: "U1", responses: ["vid1"] },
      { user_id: "U2", responses: ["vid2", "vid3"] },
    ];
    mockValidate.mockResolvedValue({ period: "all" });
    mockFetchMentions.mockResolvedValue(mockTags);

    const response = await videoHandler(makeRequest());
    const body = await response.json();

    expect(body.total_videos).toBe(3);
    expect(body.tags_with_videos).toBe(2);
  });

  it("returns auth error when validate returns NextResponse", async () => {
    mockValidate.mockResolvedValue(
      NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 }),
    );

    const response = await handler(makeRequest());
    expect(response.status).toBe(403);
  });

  it("returns 500 when fetchMentions throws", async () => {
    mockValidate.mockResolvedValue({ period: "all" });
    mockFetchMentions.mockRejectedValue(new Error("Slack API error"));

    const response = await handler(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.status).toBe("error");
  });

  it("passes period from validate to fetchMentions", async () => {
    mockValidate.mockResolvedValue({ period: "weekly" });
    mockFetchMentions.mockResolvedValue([]);

    await handler(makeRequest("weekly"));

    expect(mockFetchMentions).toHaveBeenCalledWith("weekly");
  });
});
