import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getSlackTagsHandler } from "../getSlackTagsHandler";
import { validateGetSlackTagsQuery } from "../validateGetSlackTagsQuery";
import { fetchSlackMentions } from "../fetchSlackMentions";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetSlackTagsQuery", () => ({
  validateGetSlackTagsQuery: vi.fn(),
}));

vi.mock("../fetchSlackMentions", () => ({
  fetchSlackMentions: vi.fn(),
}));

const mockTags = [
  {
    user_id: "U012AB3CD",
    user_name: "Jane Smith",
    user_avatar: "https://avatars.slack-edge.com/jane.jpg",
    prompt: "add dark mode support",
    timestamp: "2024-01-15T10:30:00.000Z",
    channel_id: "C012AB3CD",
    channel_name: "dev-team",
    pull_requests: ["https://github.com/recoupable-com/api/pull/42"],
  },
  {
    user_id: "U098ZY7WX",
    user_name: "Bob Lee",
    user_avatar: null,
    prompt: "fix login bug",
    timestamp: "2024-01-14T08:00:00.000Z",
    channel_id: "C012AB3CD",
    channel_name: "dev-team",
    pull_requests: [],
  },
];

/**
 * Creates a NextRequest targeting the Slack tags endpoint with the given period query param.
 *
 * @param period - The time period to filter tags by (e.g., "all", "daily", "weekly", "monthly").
 * @returns A NextRequest instance for the Slack tags admin endpoint.
 */
function makeRequest(period = "all") {
  return new NextRequest(`https://example.com/api/admins/coding/slack?period=${period}`);
}

describe("getSlackTagsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful cases", () => {
    it("returns 200 with tags and total", async () => {
      vi.mocked(validateGetSlackTagsQuery).mockResolvedValue({ period: "all" });
      vi.mocked(fetchSlackMentions).mockResolvedValue(mockTags);

      const response = await getSlackTagsHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      expect(body.total).toBe(2);
      expect(body.tags).toEqual(mockTags);
    });

    it("returns 200 with empty tags when no mentions found", async () => {
      vi.mocked(validateGetSlackTagsQuery).mockResolvedValue({ period: "daily" });
      vi.mocked(fetchSlackMentions).mockResolvedValue([]);

      const response = await getSlackTagsHandler(makeRequest("daily"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      expect(body.total).toBe(0);
      expect(body.tags).toEqual([]);
    });

    it("passes the period to fetchSlackMentions", async () => {
      vi.mocked(validateGetSlackTagsQuery).mockResolvedValue({ period: "weekly" });
      vi.mocked(fetchSlackMentions).mockResolvedValue([]);

      await getSlackTagsHandler(makeRequest("weekly"));

      expect(fetchSlackMentions).toHaveBeenCalledWith("weekly");
    });
  });

  describe("error cases", () => {
    it("returns auth error when validateGetSlackTagsQuery returns NextResponse", async () => {
      const errorResponse = NextResponse.json(
        { status: "error", message: "Forbidden" },
        { status: 403 },
      );
      vi.mocked(validateGetSlackTagsQuery).mockResolvedValue(errorResponse);

      const response = await getSlackTagsHandler(makeRequest());

      expect(response.status).toBe(403);
    });

    it("returns 500 when fetchSlackMentions throws", async () => {
      vi.mocked(validateGetSlackTagsQuery).mockResolvedValue({ period: "all" });
      vi.mocked(fetchSlackMentions).mockRejectedValue(new Error("Slack API error"));

      const response = await getSlackTagsHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.status).toBe("error");
    });
  });
});
