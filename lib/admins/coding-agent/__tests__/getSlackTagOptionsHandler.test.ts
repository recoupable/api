import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getSlackTagOptionsHandler } from "../getSlackTagOptionsHandler";

import { validateGetSlackTagOptionsQuery } from "../validateGetSlackTagOptionsQuery";
import { fetchSlackMentions } from "@/lib/admins/slack/fetchSlackMentions";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetSlackTagOptionsQuery", () => ({
  validateGetSlackTagOptionsQuery: vi.fn(),
}));

vi.mock("@/lib/admins/slack/fetchSlackMentions", () => ({
  fetchSlackMentions: vi.fn(),
}));

const mockMentions = [
  {
    user_id: "U001",
    user_name: "Bob",
    user_avatar: null,
    prompt: "hello",
    timestamp: "2026-01-01T00:00:00Z",
    channel_id: "C001",
    channel_name: "general",
    pull_requests: [],
  },
  {
    user_id: "U002",
    user_name: "Alice",
    user_avatar: "https://example.com/alice.png",
    prompt: "fix bug",
    timestamp: "2026-01-02T00:00:00Z",
    channel_id: "C001",
    channel_name: "general",
    pull_requests: [],
  },
  {
    user_id: "U001",
    user_name: "Bob",
    user_avatar: null,
    prompt: "second mention",
    timestamp: "2026-01-03T00:00:00Z",
    channel_id: "C002",
    channel_name: "random",
    pull_requests: [],
  },
];

/**
 *
 */
function makeRequest() {
  return new NextRequest("https://api.example.com/api/admins/coding-agent/slack-tags");
}

describe("getSlackTagOptionsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful cases", () => {
    it("returns unique users sorted alphabetically", async () => {
      vi.mocked(validateGetSlackTagOptionsQuery).mockResolvedValue(true);
      vi.mocked(fetchSlackMentions).mockResolvedValue(mockMentions);

      const response = await getSlackTagOptionsHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      expect(body.total).toBe(2);
      // Sorted alphabetically: Alice before Bob
      expect(body.tags[0].name).toBe("Alice");
      expect(body.tags[1].name).toBe("Bob");
    });

    it("deduplicates users appearing in multiple mentions", async () => {
      vi.mocked(validateGetSlackTagOptionsQuery).mockResolvedValue(true);
      vi.mocked(fetchSlackMentions).mockResolvedValue(mockMentions);

      const response = await getSlackTagOptionsHandler(makeRequest());
      const body = await response.json();

      expect(body.total).toBe(2); // U001 and U002 only
    });

    it("returns empty tags when no mentions exist", async () => {
      vi.mocked(validateGetSlackTagOptionsQuery).mockResolvedValue(true);
      vi.mocked(fetchSlackMentions).mockResolvedValue([]);

      const response = await getSlackTagOptionsHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.total).toBe(0);
      expect(body.tags).toEqual([]);
    });
  });

  describe("error cases", () => {
    it("returns 401 when auth fails", async () => {
      const { NextResponse } = await import("next/server");
      vi.mocked(validateGetSlackTagOptionsQuery).mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );

      const response = await getSlackTagOptionsHandler(makeRequest());
      expect(response.status).toBe(401);
    });

    it("returns 500 when fetchSlackMentions throws", async () => {
      vi.mocked(validateGetSlackTagOptionsQuery).mockResolvedValue(true);
      vi.mocked(fetchSlackMentions).mockRejectedValue(new Error("Slack API error"));

      const response = await getSlackTagOptionsHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.status).toBe("error");
    });
  });
});
