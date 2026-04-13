import type { AdminPeriod } from "@/lib/admins/adminPeriod";
import { slackGet } from "@/lib/slack/slackGet";
import { getBotUserId } from "@/lib/slack/getBotUserId";
import { getBotChannels } from "@/lib/slack/getBotChannels";
import { getCutoffTs } from "@/lib/admins/slack/getCutoffTs";
import {
  fetchThreadReplyMentions,
  type RawMention,
  type ThreadToScan,
} from "@/lib/admins/slack/fetchThreadReplyMentions";
import { getSlackUserInfo } from "@/lib/slack/getSlackUserInfo";

export interface BotTag {
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  prompt: string;
  timestamp: string;
  channel_id: string;
  channel_name: string;
  responses: string[];
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
    reply_count?: number;
  }>;
  response_metadata?: { next_cursor?: string };
}

interface FetchBotMentionsOptions {
  tokenEnvVar: string;
  period: AdminPeriod;
  fetchThreadResponses: (
    token: string,
    threads: Array<{ channelId: string; ts: string }>,
  ) => Promise<string[][]>;
}

/**
 * Fetches all Slack messages where a bot was mentioned.
 * Generic over the bot token and thread response extractor.
 *
 * @param options - Configuration for which bot and how to extract thread responses
 * @returns Array of BotTag objects representing each mention event, sorted newest first
 */
export async function fetchBotMentions(options: FetchBotMentionsOptions): Promise<BotTag[]> {
  const { tokenEnvVar, period, fetchThreadResponses } = options;
  const token = process.env[tokenEnvVar];
  if (!token) {
    throw new Error(`${tokenEnvVar} is not configured`);
  }

  const botUserId = await getBotUserId(token);
  const mentionPattern = `<@${botUserId}>`;
  const mentionRegex = new RegExp(`${mentionPattern}\\s*`, "g");
  const channels = await getBotChannels(token);
  const cutoffTs = getCutoffTs(period);
  const mentions: RawMention[] = [];
  const userCache: Record<string, { name: string; avatar: string | null }> = {};
  const threadsToScan: ThreadToScan[] = [];

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

        if (msg.ts && (msg.reply_count ?? 0) > 0) {
          threadsToScan.push({
            channelId: channel.id,
            channelName: channel.name,
            parentTs: msg.ts,
          });
        }

        if (!msg.text?.includes(mentionPattern)) continue;
        if (!msg.ts) continue;

        if (!userCache[msg.user]) {
          userCache[msg.user] = await getSlackUserInfo(token, msg.user);
        }

        mentions.push({
          userId: msg.user,
          prompt: (msg.text ?? "").replace(mentionRegex, "").trim(),
          ts: msg.ts,
          channelId: channel.id,
          channelName: channel.name,
        });
      }

      cursor = history.response_metadata?.next_cursor || undefined;
    } while (cursor);
  }

  const threadMentions = await fetchThreadReplyMentions({
    token,
    threadsToScan,
    mentionPattern,
    mentionRegex,
    cutoffTs,
    userCache,
  });
  mentions.push(...threadMentions);

  const responses = await fetchThreadResponses(
    token,
    mentions.map(m => ({ channelId: m.channelId, ts: m.threadTs ?? m.ts })),
  );

  const tags: BotTag[] = mentions.map((m, i) => {
    const { name, avatar } = userCache[m.userId];
    return {
      user_id: m.userId,
      user_name: name,
      user_avatar: avatar,
      prompt: m.prompt,
      timestamp: new Date(parseFloat(m.ts) * 1000).toISOString(),
      channel_id: m.channelId,
      channel_name: m.channelName,
      responses: responses[i],
    };
  });

  tags.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return tags;
}
