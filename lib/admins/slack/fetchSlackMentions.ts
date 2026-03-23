import type { AdminPeriod } from "@/lib/admins/adminPeriod";
import { slackGet } from "@/lib/slack/slackGet";
import { getCutoffTs } from "./getCutoffTs";

export interface SlackTag {
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  prompt: string;
  timestamp: string;
  channel_id: string;
  channel_name: string;
}

interface AuthTestResponse {
  ok: boolean;
  error?: string;
  user_id?: string;
}

interface ConversationsListResponse {
  ok: boolean;
  error?: string;
  channels?: Array<{ id: string; name: string }>;
  response_metadata?: { next_cursor?: string };
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

interface UsersInfoResponse {
  ok: boolean;
  error?: string;
  user?: {
    id: string;
    real_name?: string;
    profile?: {
      display_name?: string;
      real_name?: string;
      image_48?: string;
    };
  };
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

  // Get the bot's own user ID so we can detect mentions
  const authTest = await slackGet<AuthTestResponse>("auth.test", token);
  if (!authTest.ok || !authTest.user_id) {
    throw new Error(`Slack auth.test failed: ${authTest.error ?? "unknown error"}`);
  }
  const botUserId = authTest.user_id;
  const mentionPattern = `<@${botUserId}>`;

  // Get all channels the bot is a member of
  const channels: Array<{ id: string; name: string }> = [];
  let channelCursor: string | undefined;

  do {
    const params: Record<string, string> = {
      types: "public_channel,private_channel",
      limit: "200",
    };
    if (channelCursor) params.cursor = channelCursor;

    const resp = await slackGet<ConversationsListResponse>("conversations.list", token, params);
    if (!resp.ok) break;

    if (resp.channels) {
      channels.push(...resp.channels);
    }
    channelCursor = resp.response_metadata?.next_cursor || undefined;
  } while (channelCursor);

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
        // Only process human messages (not bot messages) that mention the bot
        if (msg.bot_id) continue;
        if (!msg.user) continue;
        if (!msg.text?.includes(mentionPattern)) continue;

        const userId = msg.user;

        // Resolve user info (cache to avoid repeated API calls)
        if (!userCache[userId]) {
          const userResp = await slackGet<UsersInfoResponse>("users.info", token, {
            user: userId,
          });
          const profile = userResp.user?.profile;
          userCache[userId] = {
            name: profile?.display_name || profile?.real_name || userResp.user?.real_name || userId,
            avatar: profile?.image_48 ?? null,
          };
        }

        const { name, avatar } = userCache[userId];

        // Strip the bot mention from the prompt text
        const prompt = (msg.text ?? "").replace(new RegExp(`<@${botUserId}>\\s*`, "g"), "").trim();

        tags.push({
          user_id: userId,
          user_name: name,
          user_avatar: avatar,
          prompt,
          timestamp: new Date(parseFloat(msg.ts ?? "0") * 1000).toISOString(),
          channel_id: channel.id,
          channel_name: channel.name,
        });
      }

      cursor = history.response_metadata?.next_cursor || undefined;
    } while (cursor);
  }

  // Sort newest first
  tags.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return tags;
}
