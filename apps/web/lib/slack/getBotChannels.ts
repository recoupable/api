import { slackGet } from "./slackGet";

interface ConversationsListResponse {
  ok: boolean;
  error?: string;
  channels?: Array<{ id: string; name: string }>;
  response_metadata?: { next_cursor?: string };
}

/**
 * Returns all channels the bot is a member of, paginating through all results.
 */
export async function getBotChannels(token: string): Promise<Array<{ id: string; name: string }>> {
  const channels: Array<{ id: string; name: string }> = [];
  let cursor: string | undefined;

  do {
    const params: Record<string, string> = {
      types: "public_channel,private_channel",
      limit: "200",
    };
    if (cursor) params.cursor = cursor;

    const resp = await slackGet<ConversationsListResponse>("conversations.list", token, params);
    if (!resp.ok) break;

    if (resp.channels) {
      channels.push(...resp.channels);
    }
    cursor = resp.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return channels;
}
