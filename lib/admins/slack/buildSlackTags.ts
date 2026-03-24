import type { SlackTag } from "./fetchSlackMentions";

interface RawMention {
  userId: string;
  prompt: string;
  ts: string;
  channelId: string;
  channelName: string;
}

/**
 * Builds SlackTag objects from raw mentions, user cache, and PR results.
 * Returns tags sorted newest first.
 */
export function buildSlackTags(
  mentions: RawMention[],
  userCache: Record<string, { name: string; avatar: string | null }>,
  pullRequests: string[][],
): SlackTag[] {
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
      pull_requests: pullRequests[i],
    };
  });

  tags.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return tags;
}
