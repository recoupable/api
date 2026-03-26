import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getContentSlackTagsHandler } from "../getContentSlackTagsHandler";
import { validateGetContentSlackTagsQuery } from "../validateGetContentSlackTagsQuery";
import { fetchContentSlackMentions } from "../fetchContentSlackMentions";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetContentSlackTagsQuery", () => ({
  validateGetContentSlackTagsQuery: vi.fn(),
}));

vi.mock("../fetchContentSlackMentions", () => ({
  fetchContentSlackMentions: vi.fn(),
}));

const mockTags = [
  {
    user_id: "U012AB3CD",
    user_name: "Jane Smith",
    user_avatar: "https://avatars.slack-edge.com/jane.jpg",
    prompt: "create a video for this track",
    timestamp: "2024-01-15T10:30:00.000Z",
    channel_id: "C012AB3CD",
    channel_name: "content-team",
    video_links: ["https://example.com/video/abc123"],
  },
  {
    user_id: "U098ZY7WX",
    user_name: "Bob Lee",
    user_avatar: null,
    prompt: "make a promo clip",
    timestamp: "2024-01-14T08:00:00.000Z",
    channel_id: "C012AB3CD",
    channel_name: "content-team",
    video_links: [],
  },
];

/**
 *
 * @param period
 */
function makeRequest(period = "all") {
  return new NextRequest(`https://example.com/api/admins/content/slack?period=${period}`);
}

describe("getContentSlackTagsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful cases", () => {
    it("returns 200 with tags and total", async () => {
      vi.mocked(validateGetContentSlackTagsQuery).mockResolvedValue({ period: "all" });
      vi.mocked(fetchContentSlackMentions).mockResolvedValue(mockTags);

      const response = await getContentSlackTagsHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      expect(body.total).toBe(2);
      expect(body.total_videos).toBe(1);
      expect(body.tags_with_videos).toBe(1);
      expect(body.tags).toEqual(mockTags);
    });

    it("returns 200 with empty tags when no mentions found", async () => {
      vi.mocked(validateGetContentSlackTagsQuery).mockResolvedValue({ period: "daily" });
      vi.mocked(fetchContentSlackMentions).mockResolvedValue([]);

      const response = await getContentSlackTagsHandler(makeRequest("daily"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      expect(body.total).toBe(0);
      expect(body.tags).toEqual([]);
    });

    it("passes the period to fetchContentSlackMentions", async () => {
      vi.mocked(validateGetContentSlackTagsQuery).mockResolvedValue({ period: "weekly" });
      vi.mocked(fetchContentSlackMentions).mockResolvedValue([]);

      await getContentSlackTagsHandler(makeRequest("weekly"));

      expect(fetchContentSlackMentions).toHaveBeenCalledWith("weekly");
    });
  });

  describe("error cases", () => {
    it("returns auth error when validateGetContentSlackTagsQuery returns NextResponse", async () => {
      const errorResponse = NextResponse.json(
        { status: "error", message: "Forbidden" },
        { status: 403 },
      );
      vi.mocked(validateGetContentSlackTagsQuery).mockResolvedValue(errorResponse);

      const response = await getContentSlackTagsHandler(makeRequest());

      expect(response.status).toBe(403);
    });

    it("returns 500 when fetchContentSlackMentions throws", async () => {
      vi.mocked(validateGetContentSlackTagsQuery).mockResolvedValue({ period: "all" });
      vi.mocked(fetchContentSlackMentions).mockRejectedValue(new Error("Slack API error"));

      const response = await getContentSlackTagsHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.status).toBe("error");
    });
  });
});
