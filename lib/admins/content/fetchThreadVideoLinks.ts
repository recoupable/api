import { slackGet } from "@/lib/slack/slackGet";
import { extractVideoLinks } from "./extractVideoLinks";
import type { SlackAttachment, SlackBlock } from "@/lib/admins/slack/extractGithubPrUrls";

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
 * Fetches bot replies in a Slack thread and returns any video/media URLs found.
 * Extracts URLs from message text, attachment action buttons, and Block Kit blocks.
 *
 * @param token
 * @param channel
 * @param threadTs
 */
export async function fetchThreadVideoLinks(
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
    videoLinks.push(...extractVideoLinks(msg.text ?? "", msg.attachments, msg.blocks));
  }

  return [...new Set(videoLinks)];
}
