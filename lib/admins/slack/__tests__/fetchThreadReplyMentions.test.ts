import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchThreadReplyMentions, type ThreadToScan } from "../fetchThreadReplyMentions";

import { slackGet } from "@/lib/slack/slackGet";
import { getSlackUserInfo } from "@/lib/slack/getSlackUserInfo";

vi.mock("@/lib/slack/slackGet", () => ({
  slackGet: vi.fn(),
}));

vi.mock("@/lib/slack/getSlackUserInfo", () => ({
  getSlackUserInfo: vi.fn(),
}));

const mentionPattern = "<@U_BOT>";
const mentionRegex = new RegExp(`${mentionPattern}\\s*`, "g");

describe("fetchThreadReplyMentions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("collects mentions from thread replies", async () => {
    const threads: ThreadToScan[] = [
      { channelId: "C1", channelName: "general", parentTs: "1705312200.000000" },
    ];
    vi.mocked(slackGet).mockResolvedValue({
      ok: true,
      messages: [
        {
          type: "message",
          user: "U1",
          text: "parent",
          ts: "1705312200.000000",
          thread_ts: "1705312200.000000",
        },
        {
          type: "message",
          user: "U2",
          text: "<@U_BOT> help me in thread",
          ts: "1705312500.000000",
          thread_ts: "1705312200.000000",
        },
        {
          type: "message",
          bot_id: "B1",
          text: "bot reply",
          ts: "1705312600.000000",
          thread_ts: "1705312200.000000",
        },
      ],
    });
    vi.mocked(getSlackUserInfo).mockResolvedValue({ name: "Bob", avatar: null });

    const result = await fetchThreadReplyMentions({
      token: "xoxb-test",
      threadsToScan: threads,
      mentionPattern,
      mentionRegex,
      cutoffTs: null,
      userCache: {},
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      userId: "U2",
      prompt: "help me in thread",
      threadTs: "1705312200.000000",
      channelId: "C1",
      channelName: "general",
    });
    expect(slackGet).toHaveBeenCalledWith("conversations.replies", "xoxb-test", {
      channel: "C1",
      ts: "1705312200.000000",
    });
    expect(getSlackUserInfo).toHaveBeenCalledWith("xoxb-test", "U2");
  });

  it("skips replies before cutoff and reuses cached users", async () => {
    const threads: ThreadToScan[] = [
      { channelId: "C1", channelName: "general", parentTs: "1705312200.000000" },
    ];
    const userCache = { U3: { name: "Existing", avatar: "https://avatar.url" } };

    vi.mocked(slackGet).mockResolvedValue({
      ok: true,
      messages: [
        {
          type: "message",
          user: "U3",
          text: "<@U_BOT> before cutoff",
          ts: "1705312300.000000",
          thread_ts: "1705312200.000000",
        },
        {
          type: "message",
          user: "U3",
          text: "<@U_BOT> after cutoff",
          ts: "1705312500.000000",
          thread_ts: "1705312200.000000",
        },
      ],
    });

    const result = await fetchThreadReplyMentions({
      token: "xoxb-test",
      threadsToScan: threads,
      mentionPattern,
      mentionRegex,
      cutoffTs: 1705312400,
      userCache,
    });

    expect(result).toHaveLength(1);
    expect(result[0].prompt).toBe("after cutoff");
    expect(getSlackUserInfo).not.toHaveBeenCalled();
  });
});
