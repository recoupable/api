import type { AdminPeriod } from "@/lib/admins/adminPeriod";
import { slackGet } from "@/lib/slack/slackGet";
import { getBotUserId } from "@/lib/slack/getBotUserId";
import { getBotChannels } from "@/lib/slack/getBotChannels";
import { getSlackUserInfo } from "@/lib/slack/getSlackUserInfo";
import { getCutoffTs } from "./getCutoffTs";
import { extractGithubPrUrls, type SlackAttachment } from "./extractGithubPrUrls";

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

interface SlackBlock {
  type: string;
  elements?: Array<{
    type: string;
    url?: string;
    elements?: Array<{
      type: string;
      url?: string;
    }>;
  }>;
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
    attachments?: SlackAttachment[];
    blocks?: SlackBlock[];
  }>;
}

/**
 * Extracts GitHub PR URLs from Slack Block Kit blocks.
 */
function extractPrUrlsFromBlocks(blocks: SlackBlock[]): string[] {
  const prUrlPattern = /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/;
  const urls: string[] = [];

  for (const block of blocks) {
    for (const element of block.elements ?? []) {
      if (element.url && prUrlPattern.test(element.url)) {
        urls.push(element.url);
      }
      // Check nested elements (e.g. section blocks with accessory buttons)
      for (const nested of element.elements ?? []) {
        if (nested.url && prUrlPattern.test(nested.url)) {
          urls.push(nested.url);
        }
      }
    }
  }

  return urls;
}

/**
 * Fetches bot replies in a Slack thread and returns any GitHub PR URLs found.
 * Extracts URLs from message text, attachment action buttons, and Block Kit blocks.
 */
async function fetchThreadPullRequests(
  token: string,
  channel: string,
  threadTs: string,
): Promise<string[]> {
  const replies = await slackGet<ConversationsRepliesResponse>("conversations.replies", token, {
    channel,
    ts: threadTs,
  });

  if (!replies.ok) return [];

  const prUrls: string[] = [];
  for (const msg of replies.messages ?? []) {
    if (!msg.bot_id) continue;
    if (msg.ts === threadTs) continue;
    prUrls.push(...extractGithubPrUrls(msg.text ?? "", msg.attachments));
    if (msg.blocks) {
      prUrls.push(...extractPrUrlsFromBlocks(msg.blocks));
    }
  }

  return [...new Set(prUrls)];
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
  const tags: SlackTag[] = [];
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

        const userId = msg.user;

        if (!userCache[userId]) {
          userCache[userId] = await getSlackUserInfo(token, userId);
        }

        const { name, avatar } = userCache[userId];
        const prompt = (msg.text ?? "").replace(new RegExp(`<@${botUserId}>\\s*`, "g"), "").trim();
        const pullRequests = await fetchThreadPullRequests(token, channel.id, msg.ts!);

        tags.push({
          user_id: userId,
          user_name: name,
          user_avatar: avatar,
          prompt,
          timestamp: new Date(parseFloat(msg.ts!) * 1000).toISOString(),
          channel_id: channel.id,
          channel_name: channel.name,
          pull_requests: pullRequests,
        });
      }

      cursor = history.response_metadata?.next_cursor || undefined;
    } while (cursor);
  }

  tags.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return tags;
}
