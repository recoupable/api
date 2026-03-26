import type { AdminPeriod } from "@/lib/admins/adminPeriod";
import { slackGet } from "@/lib/slack/slackGet";
import { getBotUserId } from "@/lib/slack/getBotUserId";
import { getBotChannels } from "@/lib/slack/getBotChannels";
import { getSlackUserInfo } from "@/lib/slack/getSlackUserInfo";
import { getCutoffTs } from "@/lib/admins/slack/getCutoffTs";
import { fetchAllThreadVideoLinks } from "./fetchAllThreadVideoLinks";
import { buildContentSlackTags } from "./buildContentSlackTags";

export interface ContentSlackTag {
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  prompt: string;
  timestamp: string;
  channel_id: string;
  channel_name: string;
  video_links: string[];
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
 * Fetches all Slack messages where the Recoup Content Agent bot was mentioned.
 * Pulls directly from the Slack API using the content bot token as the source of truth.
 *
 * @param period - Time period filter: "all", "daily", "weekly", or "monthly"
 * @returns Array of ContentSlackTag objects representing each mention event
 */
export async function fetchContentSlackMentions(period: AdminPeriod): Promise<ContentSlackTag[]> {
  const token = process.env.SLACK_CONTENT_BOT_TOKEN;
  if (!token) {
    throw new Error("SLACK_CONTENT_BOT_TOKEN is not configured");
  }

  const botUserId = await getBotUserId(token);
  const mentionPattern = `<@${botUserId}>`;
  const channels = await getBotChannels(token);
  const cutoffTs = getCutoffTs(period);
  const mentions: RawMention[] = [];
  const userCache: Record<string, { name: string; avatar: string | null }> = {};

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

  const videoLinks = await fetchAllThreadVideoLinks(
    token,
    mentions.map(m => ({ channelId: m.channelId, ts: m.ts })),
  );

  return buildContentSlackTags(mentions, userCache, videoLinks);
}
