import supabase from "@/lib/supabase/serverClient";

export interface SelectChatsWithSessionsParams {
  /** Filter by `sessions.account_id`. `undefined` = all accounts; `[]` = empty result. */
  accountIds?: string[];
  /** Filter by `sessions.artist_id`. Composes with `accountIds`. */
  artistAccountId?: string;
}

const SELECT = `
  *,
  session:sessions!inner ( id, account_id, artist_id, status ),
  messages:chat_messages!inner ( id )
` as const;

/**
 * Lists chats joined to their owning session, newest first. Excludes archived
 * sessions and (via `chat_messages!inner`) chats with no messages. Returns
 * `null` on error so callers can distinguish failure from an empty result.
 */
export async function selectChatsWithSessions(params: SelectChatsWithSessionsParams = {}) {
  const { accountIds, artistAccountId } = params;

  if (accountIds !== undefined && accountIds.length === 0) {
    return [];
  }

  let query = supabase.from("chats").select(SELECT).neq("session.status", "archived");
  if (accountIds !== undefined) {
    query = query.in("session.account_id", accountIds);
  }
  if (artistAccountId) {
    query = query.eq("session.artist_id", artistAccountId);
  }
  const { data, error } = await query.order("updated_at", { ascending: false });

  if (error) {
    console.error("[selectChatsWithSessions] error:", error);
    return null;
  }

  return data ?? [];
}
