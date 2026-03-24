import type { AdminPeriod } from "@/lib/admins/adminPeriod";
import { slackGet } from "@/lib/slack/slackGet";
import { getBotUserId } from "@/lib/slack/getBotUserId";
import { getBotChannels } from "@/lib/slack/getBotChannels";
import { getSlackUserInfo } from "@/lib/slack/getSlackUserInfo";
import { getCutoffTs } from "./getCutoffTs";
import { fetchThreadPullRequests } from "./fetchThreadPullRequests";

export interface SlackTag {
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  prompt: string;
  timestamp: string;
  channel_id: string;
  channel_name: string;
  pull_requests: string[];
}

interface ConversationsHistoryResponse {
  ok: boolean;
  error?: string;
  messages?: Array<{
    type: string;
    user?: string;
    text?: string;
    ts?: string;
    bot_id?: string;
  }>;
  response_metadata?: { next_cursor?: string };
}

interface RawMention {
  userId: string;
  prompt: string;
  ts: string;
  channelId: string;
  channelName: string;
}

/**
 * Fetches all Slack messages where the Recoup Coding Agent bot was mentioned.
 * Pulls directly from the Slack API using the bot token as the source of truth.
 *
 * @param period - Time period filter: "all", "daily", "weekly", or "monthly"
 * @returns Array of SlackTag objects representing each mention event
 */
export async function fetchSlackMentions(period: AdminPeriod): Promise<SlackTag[]> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new Error("SLACK_BOT_TOKEN is not configured");
  }

  const botUserId = await getBotUserId(token);
  const mentionPattern = `<@${botUserId}>`;
  const channels = await getBotChannels(token);
  const cutoffTs = getCutoffTs(period);
  const mentions: RawMention[] = [];
  const userCache: Record<string, { name: string; avatar: string | null }> = {};

  // Phase 1: Collect all mentions from channel history
  for (const channel of channels) {
    let cursor: string | undefined;

    do {
      const params: Record<string, string> = { channel: channel.id, limit: "200" };
      if (cursor) params.cursor = cursor;
      if (cutoffTs) params.oldest = String(cutoffTs);

      const history = await slackGet<ConversationsHistoryResponse>(
        "conversations.history",
        token,
        params,
      );
      if (!history.ok) break;

      for (const msg of history.messages ?? []) {
        if (msg.bot_id) continue;
        if (!msg.user) continue;
        if (!msg.text?.includes(mentionPattern)) continue;
        if (!msg.ts) continue;

        if (!userCache[msg.user]) {
          userCache[msg.user] = await getSlackUserInfo(token, msg.user);
        }

        mentions.push({
          userId: msg.user,
          prompt: (msg.text ?? "").replace(new RegExp(`<@${botUserId}>\\s*`, "g"), "").trim(),
          ts: msg.ts,
          channelId: channel.id,
          channelName: channel.name,
        });
      }

      cursor = history.response_metadata?.next_cursor || undefined;
    } while (cursor);
  }

  // Phase 2: Fetch thread PRs in parallel batches
  const BATCH_SIZE = 10;
  const allPullRequests: string[][] = new Array(mentions.length).fill([]);

  for (let i = 0; i < mentions.length; i += BATCH_SIZE) {
    const batch = mentions.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(m => fetchThreadPullRequests(token, m.channelId, m.ts)),
    );
    for (let j = 0; j < batch.length; j++) {
      allPullRequests[i + j] = results[j];
    }
  }

  // Phase 3: Build final tags
  const tags: SlackTag[] = mentions.map((m, i) => {
    const { name, avatar } = userCache[m.userId];
    return {
      user_id: m.userId,
      user_name: name,
      user_avatar: avatar,
      prompt: m.prompt,
      timestamp: new Date(parseFloat(m.ts) * 1000).toISOString(),
      channel_id: m.channelId,
      channel_name: m.channelName,
      pull_requests: allPullRequests[i],
    };
  });

  tags.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return tags;
}
