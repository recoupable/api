import supabase from "@/lib/supabase/serverClient";
import type { Tables, TablesUpdate } from "@/types/database.types";

/**
 * Subset of `chats` columns that callers are permitted to mutate via this
 * helper. Explicitly excludes structural fields (`id`, `session_id`,
 * `created_at`) so the generic update path cannot bypass chat invariants.
 */
export type ChatMutableFields = Pick<
  TablesUpdate<"chats">,
  "title" | "model_id" | "updated_at" | "active_stream_id" | "last_assistant_message_at"
>;

/**
 * Filter accepted by {@link updateChat}. Always matches by `id`. Optionally
 * adds a compare-and-set predicate on `active_stream_id` so callers can claim
 * the stream slot atomically without a bespoke helper.
 */
export type UpdateChatFilter = {
  id: string;
  /**
   * Compare-and-set predicate on `active_stream_id`:
   *
   *   - `{ equals: null }` — only update when the column is currently NULL.
   *   - `{ equals: "wrun_..." }` — only update when it matches that run id.
   *   - omitted — no predicate (plain update by id).
   */
  whereActiveStreamId?: { equals: string | null };
};

/**
 * Discriminated result so callers can distinguish:
 *   - `{ ok: true, rowsUpdated: 1 }` — claimed / updated as intended
 *   - `{ ok: true, rowsUpdated: 0 }` — predicate matched zero rows (a CAS race lost, or `id` not found)
 *   - `{ ok: false, error }` — Supabase / network failure
 *
 * Returning `false` for both "race lost" and "DB error" was a P1 issue in the
 * earlier `compareAndSetChatActiveStreamId` helper — this shape forces the
 * caller to handle the two cases distinctly.
 */
export type UpdateChatResult =
  | { ok: true; rowsUpdated: number; row: Tables<"chats"> | null }
  | { ok: false; error: string };

/**
 * Updates a `chats` row with an optional CAS-style predicate. Returns a
 * discriminated result so callers can distinguish "predicate didn't match"
 * (a race) from "Supabase failure" (operational issue).
 *
 * @param filter - `{ id }` plus an optional `whereActiveStreamId` predicate.
 * @param updates - Partial chat row (only safe-to-mutate columns).
 */
export async function updateChat(
  filter: UpdateChatFilter,
  updates: ChatMutableFields,
): Promise<UpdateChatResult> {
  const base = supabase.from("chats").update(updates).eq("id", filter.id);

  const predicated =
    filter.whereActiveStreamId === undefined
      ? base
      : filter.whereActiveStreamId.equals === null
        ? base.is("active_stream_id", null)
        : base.eq("active_stream_id", filter.whereActiveStreamId.equals);

  const { data, error } = await predicated.select();
  if (error) {
    console.error("[updateChat] error:", error);
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    rowsUpdated: data?.length ?? 0,
    row: data?.[0] ?? null,
  };
}
