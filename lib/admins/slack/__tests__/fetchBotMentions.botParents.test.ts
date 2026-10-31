import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBotMentions } from "../fetchBotMentions";
import { slackGet } from "@/lib/slack/slackGet";
import { getBotUserId } from "@/lib/slack/getBotUserId";
import { getBotChannels } from "@/lib/slack/getBotChannels";
import { getSlackUserInfo } from "@/lib/slack/getSlackUserInfo";
import { getCutoffTs } from "@/lib/admins/slack/getCutoffTs";

vi.mock("@/lib/slack/slackGet", () => ({ slackGet: vi.fn() }));
vi.mock("@/lib/slack/getBotUserId", () => ({ getBotUserId: vi.fn() }));
vi.mock("@/lib/slack/getBotChannels", () => ({ getBotChannels: vi.fn() }));
vi.mock("@/lib/slack/getSlackUserInfo", () => ({ getSlackUserInfo: vi.fn() }));
vi.mock("@/lib/admins/slack/getCutoffTs", () => ({ getCutoffTs: vi.fn() }));

function slackResponse(messages: object[]) {
  return { ok: true, messages };
}

const parentTs = "1705312200.000000";
const replyTs = "1705312500.000000";
const request = { tokenEnvVar: "MENTION_TEST_TOKEN", period: "all" as const };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("MENTION_TEST_TOKEN", "fixture-token");
  vi.mocked(getBotUserId).mockResolvedValue("U_BOT");
  vi.mocked(getBotChannels).mockResolvedValue([{ id: "channel", name: "content" }]);
  vi.mocked(getCutoffTs).mockReturnValue(null);
  vi.mocked(getSlackUserInfo).mockResolvedValue({ name: "Creator", avatar: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("human mentions inside bot-authored threads", () => {
  it.each(["U_BOT", undefined])(
    "scans the bot parent with user=%s but only reports the human reply",
    async user => {
      const parent = {
        type: "message",
        user,
        bot_id: "bot",
        text: "<@U_BOT> generated content",
        ts: parentTs,
        reply_count: 2,
      };
      const reply = {
        type: "message",
        user: "human",
        text: "<@U_BOT> change the title",
        ts: replyTs,
        thread_ts: parentTs,
      };
      vi.mocked(slackGet)
        .mockResolvedValueOnce(slackResponse([parent]))
        .mockResolvedValueOnce(
          slackResponse([
            parent,
            reply,
            { ...reply, user: "U_BOT", bot_id: "bot", text: "<@U_BOT> result" },
          ]),
        );
      const fetchThreadResponses = vi.fn().mockResolvedValue([["existing-result.mp4"]]);
      const tags = await fetchBotMentions({ ...request, fetchThreadResponses });
      expect(tags).toEqual([
        {
          user_id: "human",
          user_name: "Creator",
          user_avatar: null,
          prompt: "change the title",
          timestamp: new Date(parseFloat(replyTs) * 1000).toISOString(),
          channel_id: "channel",
          channel_name: "content",
          responses: ["existing-result.mp4"],
        },
      ]);
      expect(slackGet).toHaveBeenCalledWith("conversations.replies", "fixture-token", {
        channel: "channel",
        ts: parentTs,
      });
      expect(getSlackUserInfo).toHaveBeenCalledExactlyOnceWith("fixture-token", "human");
      expect(fetchThreadResponses).toHaveBeenCalledWith("fixture-token", [
        { channelId: "channel", ts: parentTs },
      ]);
    },
  );
  it("does not scan bot messages with no replies", async () => {
    vi.mocked(slackGet).mockResolvedValue(
      slackResponse([
        {
          type: "message",
          bot_id: "bot",
          text: "<@U_BOT> no replies",
          ts: parentTs,
          reply_count: 0,
        },
      ]),
    );
    const tags = await fetchBotMentions({
      ...request,
      fetchThreadResponses: vi.fn().mockResolvedValue([]),
    });
    expect(tags).toEqual([]);
    expect(slackGet).toHaveBeenCalledOnce();
    expect(getSlackUserInfo).not.toHaveBeenCalled();
  });
  it("keeps the reply cutoff for newly included bot-parent threads", async () => {
    vi.mocked(getCutoffTs).mockReturnValue(1705312400);
    vi.mocked(slackGet)
      .mockResolvedValueOnce(
        slackResponse([{ type: "message", bot_id: "bot", ts: parentTs, reply_count: 2 }]),
      )
      .mockResolvedValueOnce(
        slackResponse([
          { type: "message", user: "human", text: "<@U_BOT> old", ts: "1705312300.000000" },
          { type: "message", user: "human", text: "<@U_BOT> current", ts: replyTs },
        ]),
      );
    const tags = await fetchBotMentions({
      ...request,
      period: "weekly",
      fetchThreadResponses: vi.fn().mockResolvedValue([[]]),
    });
    expect(tags.map(tag => tag.prompt)).toEqual(["current"]);
    expect(getSlackUserInfo).toHaveBeenCalledOnce();
  });
});
