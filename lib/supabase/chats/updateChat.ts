import supabase from "@/lib/supabase/serverClient";
import type { Tables, TablesUpdate } from "@/types/database.types";

/**
 * Subset of `chats` columns that callers are permitted to mutate via this
 * helper. Explicitly excludes structural fields (`id`, `session_id`,
 * `created_at`) so generic updates cannot bypass chat invariants.
 */
export type ChatMutableFields = Pick<
  TablesUpdate<"chats">,
  "title" | "model_id" | "updated_at" | "active_stream_id" | "last_assistant_message_at"
>;

/**
 * Filter accepted by {@link updateChat}. Always matches by `id`. Optional
 * `where` adds AND-ed predicates per column — generic across columns so
 * domain-specific concerns (e.g. CAS on `active_stream_id`) stay in their
 * own wrapper helpers rather than baking into the Supabase plumbing.
 *
 * Each `where` entry maps to `column = value` (or `column IS NULL` when
 * `value === null`).
 */
export type UpdateChatFilter = {
  id: string;
  where?: Partial<Tables<"chats">>;
};

/**
 * Discriminated result so callers can distinguish:
 *   - `{ ok: true, rowsUpdated: 1 }` — updated as intended.
 *   - `{ ok: true, rowsUpdated: 0 }` — the predicate matched zero rows (a CAS
 *     race lost, or `id` not found).
 *   - `{ ok: false, error }` — Supabase / network failure.
 */
export type UpdateChatResult =
  | { ok: true; rowsUpdated: number; row: Tables<"chats"> | null }
  | { ok: false; error: string };

/**
 * Updates a `chats` row by id, optionally constrained by a generic `where`
 * predicate. Returns a discriminated result so callers can tell
 * "predicate didn't match" (a race lost) from "Supabase failure" (operational
 * issue) — the previous behavior of returning `false` for both was a CAS bug.
 */
export async function updateChat(
  filter: UpdateChatFilter,
  updates: ChatMutableFields,
): Promise<UpdateChatResult> {
  // Split the optional `where` map into nullable vs equality predicates so we
  // can apply each as a single chained call (`.match()` for equalities,
  // `.is(col, null)` per nullable). Iterating with `let query = ...` and
  // reassigning in a for-loop confuses Supabase's deeply generic builder
  // types ("type instantiation is excessively deep") in the Next.js build.
  const entries = Object.entries(filter.where ?? {});
  const equalityMatches: Record<string, unknown> = {};
  const nullColumns: string[] = [];
  for (const [column, value] of entries) {
    if (value === null) {
      nullColumns.push(column);
    } else {
      equalityMatches[column] = value;
    }
  }

  const baseQuery = supabase
    .from("chats")
    .update(updates)
    .eq("id", filter.id)
    .match(equalityMatches);
  const finalQuery = nullColumns.reduce<typeof baseQuery>(
    (q, column) => q.is(column, null) as typeof baseQuery,
    baseQuery,
  );

  const { data, error } = await finalQuery.select();
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
