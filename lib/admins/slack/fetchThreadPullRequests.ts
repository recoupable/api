import { slackGet } from "@/lib/slack/slackGet";
import { extractGithubPrUrls, type SlackAttachment, type SlackBlock } from "./extractGithubPrUrls";

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
 * Fetches bot replies in a Slack thread and returns any GitHub PR URLs found.
 * Extracts URLs from message text, attachment action buttons, and Block Kit blocks.
 */
export async function fetchThreadPullRequests(
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
    prUrls.push(...extractGithubPrUrls(msg.text ?? "", msg.attachments, msg.blocks));
  }

  return [...new Set(prUrls)];
}
