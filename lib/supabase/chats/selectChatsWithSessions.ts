import supabase from "@/lib/supabase/serverClient";

export interface SelectChatsWithSessionsParams {
  /**
   * Owning account IDs to filter by (via `sessions.account_id`).
   * - `undefined` returns chats across all accounts (admin scope).
   * - `[]` short-circuits to an empty result.
   */
  accountIds?: string[];
  /**
   * Optional artist account id to filter by (via `sessions.artist_id`).
   * Composes with `accountIds`: scopes the result to chats whose owning
   * session both belongs to one of the accountIds AND is in the given
   * artist context.
   */
  artistAccountId?: string;
}

const SELECT = `
  *,
  session:sessions!inner ( id, account_id, artist_id, status ),
  messages:chat_messages!inner ( id )
` as const;

/**
 * Reads chats joined to their owning session, optionally scoped to a set of
 * account IDs through `sessions.account_id` and/or an artist context through
 * `sessions.artist_id`. Chats whose session is archived
 * (`sessions.status === "archived"`) are excluded — archive is the
 * soft-delete path, and archived sessions should not surface in chat
 * listings. Chats with no messages are also excluded: the
 * `chat_messages!inner` embed inner-joins messages, so a chat only surfaces
 * once it has at least one message. Results are ordered by
 * `chats.updated_at` descending so newest activity surfaces first.
 *
 * Returns `null` when Supabase reports an error so callers can distinguish a
 * transient failure from an empty result. Row shape is inferred from the
 * typed supabase-js client — both `chats.*` and the embedded `session`
 * projection surface to callers without an explicit type alias.
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
