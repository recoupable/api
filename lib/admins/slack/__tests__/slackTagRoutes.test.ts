import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET as getMentions } from "@/app/api/admins/coding/slack/route";
import { GET as getOptions, OPTIONS } from "@/app/api/admins/coding-agent/slack-tags/route";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";
import { fetchSlackMentions, type SlackTag } from "../fetchSlackMentions";

vi.mock("@/lib/admins/validateAdminAuth", () => ({ validateAdminAuth: vi.fn() }));
vi.mock("../fetchSlackMentions", () => ({ fetchSlackMentions: vi.fn() }));

const auth = { accountId: "admin-account", orgId: null, authToken: "fixture-token" };
const mentions: SlackTag[] = [
  {
    user_id: "U2",
    user_name: "Bob",
    user_avatar: null,
    prompt: "latest",
    timestamp: "2026-10-20T00:00:00Z",
    channel_id: "C1",
    channel_name: "coding",
    pull_requests: ["https://github.com/recoupable/api/pull/1"],
  },
  {
    user_id: "U1",
    user_name: "Alice",
    user_avatar: "https://example.com/alice.png",
    prompt: "another",
    timestamp: "2026-10-19T00:00:00Z",
    channel_id: "C1",
    channel_name: "coding",
    pull_requests: [],
  },
  {
    user_id: "U2",
    user_name: "Old Bob",
    user_avatar: "https://example.com/old.png",
    prompt: "older",
    timestamp: "2026-10-18T00:00:00Z",
    channel_id: "C2",
    channel_name: "other",
    pull_requests: [],
  },
  {
    user_id: "U3",
    user_name: "Alice",
    user_avatar: null,
    prompt: "same name different account",
    timestamp: "2026-10-17T00:00:00Z",
    channel_id: "C2",
    channel_name: "other",
    pull_requests: [],
  },
];

function request(path: string) {
  return new NextRequest(`https://example.com/api/admins/${path}`);
}

describe("coding Slack tag routes with actual validation and handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAdminAuth).mockResolvedValue(auth);
    vi.mocked(fetchSlackMentions).mockResolvedValue(mentions);
  });

  it("filters all matching mentions and recalculates totals after validation", async () => {
    const response = await getMentions(request("coding/slack?period=weekly&tag=U2"));
    expect(await response.json()).toEqual({
      status: "success",
      total: 2,
      total_pull_requests: 1,
      tags_with_pull_requests: 1,
      tags: [mentions[0], mentions[2]],
    });
    expect(fetchSlackMentions).toHaveBeenCalledExactlyOnceWith("weekly");
  });

  it("preserves unfiltered results when tag is omitted", async () => {
    const response = await getMentions(request("coding/slack"));
    expect(await response.json()).toEqual({
      status: "success",
      total: 4,
      total_pull_requests: 1,
      tags_with_pull_requests: 1,
      tags: mentions,
    });
  });

  it("returns options deduplicated by ID, sorted by name, retaining the first collected profile", async () => {
    const response = await getOptions(request("coding-agent/slack-tags"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "success",
      total: 3,
      tags: [
        { id: "U1", name: "Alice", avatar: "https://example.com/alice.png" },
        { id: "U3", name: "Alice", avatar: null },
        { id: "U2", name: "Bob", avatar: null },
      ],
    });
    expect(fetchSlackMentions).toHaveBeenCalledExactlyOnceWith("all");
  });

  it("returns an empty options list when no mentions were collected", async () => {
    vi.mocked(fetchSlackMentions).mockResolvedValue([]);
    const response = await getOptions(request("coding-agent/slack-tags"));
    expect(await response.json()).toEqual({ status: "success", total: 0, tags: [] });
  });

  it.each([401, 403])("does not collect Slack data when admin auth returns %i", async status => {
    vi.mocked(validateAdminAuth).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status }),
    );
    expect((await getOptions(request("coding-agent/slack-tags"))).status).toBe(status);
    expect((await getMentions(request("coding/slack?tag=U2"))).status).toBe(status);
    expect(fetchSlackMentions).not.toHaveBeenCalled();
  });

  it.each(["tag=", "tag=%20%20", "period=yearly&tag=U2"])(
    "rejects invalid query %s before collecting Slack data",
    async query => {
      const response = await getMentions(request(`coding/slack?${query}`));
      expect(response.status).toBe(400);
      expect(fetchSlackMentions).not.toHaveBeenCalled();
    },
  );

  it("returns the existing server-error shape when options collection fails", async () => {
    vi.mocked(fetchSlackMentions).mockRejectedValue(new Error("fixture collector error"));
    const response = await getOptions(request("coding-agent/slack-tags"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ status: "error", message: "Internal server error" });
  });

  it("answers CORS preflight without authentication or collection", async () => {
    const response = await OPTIONS();
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(validateAdminAuth).not.toHaveBeenCalled();
    expect(fetchSlackMentions).not.toHaveBeenCalled();
  });
});
