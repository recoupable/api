import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Chat row joined with its owning session. The embedded `session` carries the
 * owning `account_id`, which callers project to `accountId` on the wire.
 */
export type ChatWithSession = Tables<"chats"> & {
  session: Pick<Tables<"sessions">, "id" | "account_id"> | null;
};

export interface SelectChatsWithSessionsParams {
  /**
   * Owning account IDs to filter by (via `sessions.account_id`).
   * - `undefined` returns chats across all accounts (admin scope).
   * - `[]` short-circuits to an empty result.
   */
  accountIds?: string[];
}

const SELECT = `
  *,
  session:sessions!inner ( id, account_id )
` as const;

/**
 * Reads chats joined to their owning session, optionally scoped to a set of
 * account IDs through `sessions.account_id`. Ordered by `chats.updated_at`
 * descending so newest activity surfaces first.
 *
 * Returns `null` when Supabase reports an error so callers can distinguish a
 * transient failure from an empty result.
 *
 * @param params - Optional filter parameters
 * @returns Matching rows, `[]` when no rows match, or `null` on DB error.
 */
export async function selectChatsWithSessions(
  params: SelectChatsWithSessionsParams = {},
): Promise<ChatWithSession[] | null> {
  const { accountIds } = params;

  if (accountIds !== undefined && accountIds.length === 0) {
    return [];
  }

  let query = supabase.from("chats").select(SELECT);
  if (accountIds !== undefined) {
    query = query.in("session.account_id", accountIds);
  }
  const { data, error } = await query.order("updated_at", { ascending: false });

  if (error) {
    console.error("[selectChatsWithSessions] error:", error);
    return null;
  }

  return (data ?? []) as ChatWithSession[];
}
