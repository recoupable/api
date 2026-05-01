import { slackGet } from "@/lib/slack/slackGet";
import { extractVideoFiles, type SlackFile } from "./extractVideoFiles";

interface ConversationsRepliesResponse {
  ok: boolean;
  error?: string;
  messages?: Array<{
    type: string;
    user?: string;
    text?: string;
    ts?: string;
    bot_id?: string;
    files?: SlackFile[];
  }>;
}

/**
 * Fetches bot replies in a Slack thread and returns video permalinks
 * from embedded file uploads.
 *
 * @param token - Slack bot token
 * @param channel - Channel ID
 * @param threadTs - Thread timestamp
 * @returns Array of unique video permalink URLs found in bot replies
 */
export async function fetchThreadVideoFiles(
  token: string,
  channel: string,
  threadTs: string,
): Promise<string[]> {
  const replies = await slackGet<ConversationsRepliesResponse>("conversations.replies", token, {
    channel,
    ts: threadTs,
  });

  if (!replies.ok) return [];

  const videoLinks: string[] = [];
  for (const msg of replies.messages ?? []) {
    if (!msg.bot_id) continue;
    if (msg.ts === threadTs) continue;
    videoLinks.push(...extractVideoFiles(msg.files));
  }

  return [...new Set(videoLinks)];
}
