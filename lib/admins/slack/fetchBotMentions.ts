import type { AdminPeriod } from "@/lib/admins/adminPeriod";
import { slackGet } from "@/lib/slack/slackGet";
import { getBotUserId } from "@/lib/slack/getBotUserId";
import { getBotChannels } from "@/lib/slack/getBotChannels";
import { getSlackUserInfo } from "@/lib/slack/getSlackUserInfo";
import { getCutoffTs } from "@/lib/admins/slack/getCutoffTs";

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

interface ConversationsRepliesResponse {
  ok: boolean;
  error?: string;
  messages?: Array<{
    type: string;
    user?: string;
    text?: string;
    ts?: string;
    thread_ts?: string;
    bot_id?: string;
  }>;
}

interface RawMention {
  userId: string;
  prompt: string;
  ts: string;
  threadTs?: string;
  channelId: string;
  channelName: string;
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
  const channels = await getBotChannels(token);
  const cutoffTs = getCutoffTs(period);
  const mentions: RawMention[] = [];
  const userCache: Record<string, { name: string; avatar: string | null }> = {};
  const threadsToScan: Array<{ channelId: string; channelName: string; parentTs: string }> = [];

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
          prompt: (msg.text ?? "").replace(new RegExp(`<@${botUserId}>\\s*`, "g"), "").trim(),
          ts: msg.ts,
          channelId: channel.id,
          channelName: channel.name,
        });
      }

      cursor = history.response_metadata?.next_cursor || undefined;
    } while (cursor);
  }

  const THREAD_BATCH_SIZE = 5;
  const THREAD_BATCH_DELAY_MS = 1100;

  for (let i = 0; i < threadsToScan.length; i += THREAD_BATCH_SIZE) {
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, THREAD_BATCH_DELAY_MS));
    }
    const batch = threadsToScan.slice(i, i + THREAD_BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(t =>
        slackGet<ConversationsRepliesResponse>("conversations.replies", token, {
          channel: t.channelId,
          ts: t.parentTs,
        }),
      ),
    );

    for (let j = 0; j < batch.length; j++) {
      const result = batchResults[j];
      if (result.status !== "fulfilled" || !result.value.ok) continue;

      const thread = batch[j];
      for (const reply of result.value.messages ?? []) {
        if (reply.ts === thread.parentTs) continue;
        if (reply.bot_id) continue;
        if (!reply.user) continue;
        if (!reply.text?.includes(mentionPattern)) continue;
        if (!reply.ts) continue;
        if (cutoffTs && parseFloat(reply.ts) < cutoffTs) continue;

        if (!userCache[reply.user]) {
          userCache[reply.user] = await getSlackUserInfo(token, reply.user);
        }

        mentions.push({
          userId: reply.user,
          prompt: (reply.text ?? "").replace(new RegExp(`<@${botUserId}>\\s*`, "g"), "").trim(),
          ts: reply.ts,
          threadTs: thread.parentTs,
          channelId: thread.channelId,
          channelName: thread.channelName,
        });
      }
    }
  }

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
