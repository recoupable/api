import type { ContentSlackTag } from "./fetchContentSlackMentions";

interface RawMention {
  userId: string;
  prompt: string;
  ts: string;
  channelId: string;
  channelName: string;
}

/**
 * Builds ContentSlackTag objects from raw mentions, user cache, and video link results.
 * Returns tags sorted newest first.
 *
 * @param mentions
 * @param userCache
 * @param videoLinks
 */
export function buildContentSlackTags(
  mentions: RawMention[],
  userCache: Record<string, { name: string; avatar: string | null }>,
  videoLinks: string[][],
): ContentSlackTag[] {
  const tags: ContentSlackTag[] = mentions.map((m, i) => {
    const { name, avatar } = userCache[m.userId];
    return {
      user_id: m.userId,
      user_name: name,
      user_avatar: avatar,
      prompt: m.prompt,
      timestamp: new Date(parseFloat(m.ts) * 1000).toISOString(),
      channel_id: m.channelId,
      channel_name: m.channelName,
      video_links: videoLinks[i],
    };
  });

  tags.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return tags;
}
