import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchBotMentions } from "../fetchBotMentions";

import { slackGet } from "@/lib/slack/slackGet";
import { getBotUserId } from "@/lib/slack/getBotUserId";
import { getBotChannels } from "@/lib/slack/getBotChannels";
import { getSlackUserInfo } from "@/lib/slack/getSlackUserInfo";
import { getCutoffTs } from "@/lib/admins/slack/getCutoffTs";

vi.mock("@/lib/slack/slackGet", () => ({
  slackGet: vi.fn(),
}));

vi.mock("@/lib/slack/getBotUserId", () => ({
  getBotUserId: vi.fn(),
}));

vi.mock("@/lib/slack/getBotChannels", () => ({
  getBotChannels: vi.fn(),
}));

vi.mock("@/lib/slack/getSlackUserInfo", () => ({
  getSlackUserInfo: vi.fn(),
}));

vi.mock("@/lib/admins/slack/getCutoffTs", () => ({
  getCutoffTs: vi.fn(),
}));

describe("fetchBotMentions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when token is not set", async () => {
    await expect(
      fetchBotMentions({
        tokenEnvVar: "MISSING_TOKEN",
        period: "all",
        fetchThreadResponses: vi.fn().mockResolvedValue([]),
      }),
    ).rejects.toThrow("MISSING_TOKEN is not configured");
  });

  it("fetches mentions from all bot channels and builds tags", async () => {
    vi.stubEnv("TEST_BOT_TOKEN", "xoxb-test");

    vi.mocked(getBotUserId).mockResolvedValue("U_BOT");
    vi.mocked(getBotChannels).mockResolvedValue([{ id: "C1", name: "general" }]);
    vi.mocked(getCutoffTs).mockReturnValue(null);
    vi.mocked(slackGet).mockResolvedValue({
      ok: true,
      messages: [
        { type: "message", user: "U1", text: "<@U_BOT> do something", ts: "1705312200.000000" },
        { type: "message", bot_id: "B1", text: "bot reply", ts: "1705312300.000000" },
      ],
    });
    vi.mocked(getSlackUserInfo).mockResolvedValue({ name: "Alice", avatar: "https://avatar.url" });

    const mockFetchThreadResponses = vi.fn().mockResolvedValue([["response1"]]);

    const result = await fetchBotMentions({
      tokenEnvVar: "TEST_BOT_TOKEN",
      period: "all",
      fetchThreadResponses: mockFetchThreadResponses,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      user_id: "U1",
      user_name: "Alice",
      user_avatar: "https://avatar.url",
      prompt: "do something",
      channel_id: "C1",
      channel_name: "general",
      responses: ["response1"],
    });

    expect(mockFetchThreadResponses).toHaveBeenCalledWith("xoxb-test", [
      { channelId: "C1", ts: "1705312200.000000" },
    ]);

    vi.unstubAllEnvs();
  });

  it("skips messages without user or without bot mention", async () => {
    vi.stubEnv("TEST_BOT_TOKEN", "xoxb-test");

    vi.mocked(getBotUserId).mockResolvedValue("U_BOT");
    vi.mocked(getBotChannels).mockResolvedValue([{ id: "C1", name: "general" }]);
    vi.mocked(getCutoffTs).mockReturnValue(null);
    vi.mocked(slackGet).mockResolvedValue({
      ok: true,
      messages: [
        { type: "message", text: "no user field", ts: "1705312200.000000" },
        { type: "message", user: "U1", text: "no mention of bot", ts: "1705312200.000000" },
      ],
    });

    const result = await fetchBotMentions({
      tokenEnvVar: "TEST_BOT_TOKEN",
      period: "all",
      fetchThreadResponses: vi.fn().mockResolvedValue([]),
    });

    expect(result).toHaveLength(0);

    vi.unstubAllEnvs();
  });

  it("includes bot mentions from thread replies", async () => {
    vi.stubEnv("TEST_BOT_TOKEN", "xoxb-test");

    vi.mocked(getBotUserId).mockResolvedValue("U_BOT");
    vi.mocked(getBotChannels).mockResolvedValue([{ id: "C1", name: "general" }]);
    vi.mocked(getCutoffTs).mockReturnValue(null);

    // conversations.history returns a thread parent with reply_count > 0 but no bot mention
    // conversations.replies returns a reply that mentions the bot
    vi.mocked(slackGet).mockImplementation(
      (endpoint: string, _token: string, params?: Record<string, string>): Promise<any> => {
        if (endpoint === "conversations.history") {
          return Promise.resolve({
            ok: true,
            messages: [
              {
                type: "message",
                user: "U1",
                text: "start a thread",
                ts: "1705312200.000000",
                reply_count: 2,
              },
            ],
          });
        }
        if (endpoint === "conversations.replies" && params?.ts === "1705312200.000000") {
          return Promise.resolve({
            ok: true,
            messages: [
              {
                type: "message",
                user: "U1",
                text: "start a thread",
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
                text: "bot reply in thread",
                ts: "1705312600.000000",
                thread_ts: "1705312200.000000",
              },
            ],
          });
        }
        return Promise.resolve({ ok: true, messages: [] });
      },
    );

    vi.mocked(getSlackUserInfo).mockResolvedValue({ name: "Bob", avatar: null });

    const mockFetchThreadResponses = vi.fn().mockResolvedValue([["video1.mp4"]]);

    const result = await fetchBotMentions({
      tokenEnvVar: "TEST_BOT_TOKEN",
      period: "all",
      fetchThreadResponses: mockFetchThreadResponses,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      user_id: "U2",
      user_name: "Bob",
      prompt: "help me in thread",
      channel_id: "C1",
      channel_name: "general",
      responses: ["video1.mp4"],
    });

    // fetchThreadResponses should use the parent thread ts, not the reply ts
    expect(mockFetchThreadResponses).toHaveBeenCalledWith("xoxb-test", [
      { channelId: "C1", ts: "1705312200.000000" },
    ]);

    vi.unstubAllEnvs();
  });

  it("includes both top-level and thread mentions", async () => {
    vi.stubEnv("TEST_BOT_TOKEN", "xoxb-test");

    vi.mocked(getBotUserId).mockResolvedValue("U_BOT");
    vi.mocked(getBotChannels).mockResolvedValue([{ id: "C1", name: "general" }]);
    vi.mocked(getCutoffTs).mockReturnValue(null);

    vi.mocked(slackGet).mockImplementation(
      (endpoint: string, _token: string, params?: Record<string, string>): Promise<any> => {
        if (endpoint === "conversations.history") {
          return Promise.resolve({
            ok: true,
            messages: [
              {
                type: "message",
                user: "U1",
                text: "<@U_BOT> top level",
                ts: "1705312200.000000",
                reply_count: 1,
              },
            ],
          });
        }
        if (endpoint === "conversations.replies" && params?.ts === "1705312200.000000") {
          return Promise.resolve({
            ok: true,
            messages: [
              {
                type: "message",
                user: "U1",
                text: "<@U_BOT> top level",
                ts: "1705312200.000000",
                thread_ts: "1705312200.000000",
              },
              {
                type: "message",
                user: "U2",
                text: "<@U_BOT> thread reply",
                ts: "1705312500.000000",
                thread_ts: "1705312200.000000",
              },
            ],
          });
        }
        return Promise.resolve({ ok: true, messages: [] });
      },
    );

    vi.mocked(getSlackUserInfo).mockResolvedValue({ name: "User", avatar: null });

    const mockFetchThreadResponses = vi.fn().mockResolvedValue([[], []]);

    const result = await fetchBotMentions({
      tokenEnvVar: "TEST_BOT_TOKEN",
      period: "all",
      fetchThreadResponses: mockFetchThreadResponses,
    });

    // Should have both the top-level mention AND the thread reply mention
    expect(result).toHaveLength(2);
    const prompts = result.map(r => r.prompt);
    expect(prompts).toContain("top level");
    expect(prompts).toContain("thread reply");

    // Both should use the parent thread ts for fetchThreadResponses
    expect(mockFetchThreadResponses).toHaveBeenCalledWith("xoxb-test", [
      { channelId: "C1", ts: "1705312200.000000" },
      { channelId: "C1", ts: "1705312200.000000" },
    ]);

    vi.unstubAllEnvs();
  });

  it("respects cutoff when scanning thread replies", async () => {
    vi.stubEnv("TEST_BOT_TOKEN", "xoxb-test");

    vi.mocked(getBotUserId).mockResolvedValue("U_BOT");
    vi.mocked(getBotChannels).mockResolvedValue([{ id: "C1", name: "general" }]);
    // Cutoff between the two replies
    vi.mocked(getCutoffTs).mockReturnValue(1705312400);

    vi.mocked(slackGet).mockImplementation(
      (endpoint: string, _token: string, params?: Record<string, string>): Promise<any> => {
        if (endpoint === "conversations.history") {
          return Promise.resolve({
            ok: true,
            messages: [
              {
                type: "message",
                user: "U1",
                text: "thread parent",
                ts: "1705312200.000000",
                reply_count: 2,
              },
            ],
          });
        }
        if (endpoint === "conversations.replies" && params?.ts === "1705312200.000000") {
          return Promise.resolve({
            ok: true,
            messages: [
              {
                type: "message",
                user: "U1",
                text: "thread parent",
                ts: "1705312200.000000",
                thread_ts: "1705312200.000000",
              },
              {
                type: "message",
                user: "U2",
                text: "<@U_BOT> old reply before cutoff",
                ts: "1705312300.000000",
                thread_ts: "1705312200.000000",
              },
              {
                type: "message",
                user: "U3",
                text: "<@U_BOT> new reply after cutoff",
                ts: "1705312500.000000",
                thread_ts: "1705312200.000000",
              },
            ],
          });
        }
        return Promise.resolve({ ok: true, messages: [] });
      },
    );

    vi.mocked(getSlackUserInfo).mockResolvedValue({ name: "User", avatar: null });

    const mockFetchThreadResponses = vi.fn().mockResolvedValue([[]]);

    const result = await fetchBotMentions({
      tokenEnvVar: "TEST_BOT_TOKEN",
      period: "weekly",
      fetchThreadResponses: mockFetchThreadResponses,
    });

    // Only the reply after cutoff should be included
    expect(result).toHaveLength(1);
    expect(result[0].prompt).toBe("new reply after cutoff");

    vi.unstubAllEnvs();
  });

  it("sorts tags newest first", async () => {
    vi.stubEnv("TEST_BOT_TOKEN", "xoxb-test");

    vi.mocked(getBotUserId).mockResolvedValue("U_BOT");
    vi.mocked(getBotChannels).mockResolvedValue([{ id: "C1", name: "general" }]);
    vi.mocked(getCutoffTs).mockReturnValue(null);
    vi.mocked(slackGet).mockResolvedValue({
      ok: true,
      messages: [
        { type: "message", user: "U1", text: "<@U_BOT> older", ts: "1705312200.000000" },
        { type: "message", user: "U1", text: "<@U_BOT> newer", ts: "1705398600.000000" },
      ],
    });
    vi.mocked(getSlackUserInfo).mockResolvedValue({ name: "Alice", avatar: null });

    const result = await fetchBotMentions({
      tokenEnvVar: "TEST_BOT_TOKEN",
      period: "all",
      fetchThreadResponses: vi.fn().mockResolvedValue([[], []]),
    });

    expect(result[0].prompt).toBe("newer");
    expect(result[1].prompt).toBe("older");

    vi.unstubAllEnvs();
  });
});
