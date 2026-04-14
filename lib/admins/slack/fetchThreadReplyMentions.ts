import { slackGet } from "@/lib/slack/slackGet";
import { getSlackUserInfo } from "@/lib/slack/getSlackUserInfo";

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

export interface ThreadToScan {
  channelId: string;
  channelName: string;
  parentTs: string;
}

export interface RawMention {
  userId: string;
  prompt: string;
  ts: string;
  threadTs?: string;
  channelId: string;
  channelName: string;
}

interface FetchThreadReplyMentionsOptions {
  token: string;
  threadsToScan: ThreadToScan[];
  mentionPattern: string;
  mentionRegex: RegExp;
  cutoffTs: number | null;
  userCache: Record<string, { name: string; avatar: string | null }>;
}

const THREAD_BATCH_SIZE = 5;
const THREAD_BATCH_DELAY_MS = 1100;

/**
 * Fetch Thread Reply Mentions.
 *
 * @param root0 - Parameter.
 * @param root0.token - Parameter.
 * @param root0.threadsToScan - Parameter.
 * @param root0.mentionPattern - Parameter.
 * @param root0.mentionRegex - Parameter.
 * @param root0.cutoffTs - Parameter.
 * @param root0.userCache - Parameter.
 * @returns - Result.
 */
export async function fetchThreadReplyMentions({
  token,
  threadsToScan,
  mentionPattern,
  mentionRegex,
  cutoffTs,
  userCache,
}: FetchThreadReplyMentionsOptions): Promise<RawMention[]> {
  const mentions: RawMention[] = [];

  for (let i = 0; i < threadsToScan.length; i += THREAD_BATCH_SIZE) {
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, THREAD_BATCH_DELAY_MS));
    }

    const batch = threadsToScan.slice(i, i + THREAD_BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(thread =>
        slackGet<ConversationsRepliesResponse>("conversations.replies", token, {
          channel: thread.channelId,
          ts: thread.parentTs,
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
          prompt: (reply.text ?? "").replace(mentionRegex, "").trim(),
          ts: reply.ts,
          threadTs: thread.parentTs,
          channelId: thread.channelId,
          channelName: thread.channelName,
        });
      }
    }
  }

  return mentions;
}
