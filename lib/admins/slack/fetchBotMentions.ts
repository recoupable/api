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
    thread_ts?: string;
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
    bot_id?: string;
  }>;
}

interface RawMention {
  userId: string;
  prompt: string;
  ts: string;
  threadTs: string;
  channelId: string;
  channelName: string;
}

interface ThreadParent {
  channelId: string;
  channelName: string;
  ts: string;
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
 * Fetches all Slack messages where a bot was mentioned, including mentions
 * within thread replies. Generic over the bot token and thread response extractor.
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
  const threadParents: ThreadParent[] = [];
  const topLevelMentionThreads = new Set<string>();

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
        if (!msg.ts) continue;

        // Track threaded messages for scanning thread replies
        if (msg.reply_count && msg.reply_count > 0) {
          threadParents.push({
            channelId: channel.id,
            channelName: channel.name,
            ts: msg.ts,
          });
        }

        if (!msg.user) continue;
        if (!msg.text?.includes(mentionPattern)) continue;

        if (!userCache[msg.user]) {
          userCache[msg.user] = await getSlackUserInfo(token, msg.user);
        }

        mentions.push({
          userId: msg.user,
          prompt: (msg.text ?? "").replace(new RegExp(`<@${botUserId}>\\s*`, "g"), "").trim(),
          ts: msg.ts,
          threadTs: msg.ts,
          channelId: channel.id,
          channelName: channel.name,
        });

        topLevelMentionThreads.add(`${channel.id}:${msg.ts}`);
      }

      cursor = history.response_metadata?.next_cursor || undefined;
    } while (cursor);
  }

  // Scan thread replies for additional bot mentions
  const THREAD_BATCH_SIZE = 5;
  const THREAD_BATCH_DELAY_MS = 1100;

  for (let i = 0; i < threadParents.length; i += THREAD_BATCH_SIZE) {
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, THREAD_BATCH_DELAY_MS));
    }
    const batch = threadParents.slice(i, i + THREAD_BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async tp => {
        const replies = await slackGet<ConversationsRepliesResponse>(
          "conversations.replies",
          token,
          { channel: tp.channelId, ts: tp.ts },
        );
        if (!replies.ok) return [];

        const threadMentions: RawMention[] = [];
        for (const msg of replies.messages ?? []) {
          if (msg.bot_id) continue;
          if (!msg.user) continue;
          if (!msg.text?.includes(mentionPattern)) continue;
          if (!msg.ts) continue;
          // Skip the parent message (already captured as top-level)
          if (msg.ts === tp.ts) continue;

          if (!userCache[msg.user]) {
            userCache[msg.user] = await getSlackUserInfo(token, msg.user);
          }

          threadMentions.push({
            userId: msg.user,
            prompt: (msg.text ?? "").replace(new RegExp(`<@${botUserId}>\\s*`, "g"), "").trim(),
            ts: msg.ts,
            threadTs: tp.ts,
            channelId: tp.channelId,
            channelName: tp.channelName,
          });
        }
        return threadMentions;
      }),
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        mentions.push(...result.value);
      }
    }
  }

  const responses = await fetchThreadResponses(
    token,
    mentions.map(m => ({ channelId: m.channelId, ts: m.threadTs })),
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
