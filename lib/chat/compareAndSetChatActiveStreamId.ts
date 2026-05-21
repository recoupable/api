import { updateChat } from "@/lib/supabase/chats/updateChat";

/**
 * Result of the CAS attempt. Forces callers to distinguish:
 *
 *   - `{ ok: true, claimed: true }` — the row matched the expected value and
 *     was updated to `next`.
 *   - `{ ok: true, claimed: false }` — predicate didn't match (a race was
 *     lost OR the row's `active_stream_id` is in some other state).
 *   - `{ ok: false, error }` — Supabase / network failure. Distinct from
 *     "race lost" so callers don't return a misleading 409 when the DB is
 *     actually unhealthy.
 */
export type CasChatActiveStreamIdResult =
  | { ok: true; claimed: boolean }
  | { ok: false; error: string };

/**
 * Atomically swap `chats.active_stream_id` from `expected` to `next` for
 * the given chat. Domain wrapper over the generic `updateChat` helper —
 * keeps the CAS-on-active_stream_id concept here (in the chat domain)
 * rather than in the Supabase plumbing.
 *
 * Used by `/api/chat/workflow` to:
 *   - Claim the slot before `start(workflow)` (`expected: null`, `next: "pending-<uuid>"`).
 *   - Promote the placeholder to the real run id after start.
 *   - Release a stale slot in `reconcileExistingActiveStream`.
 *
 * @param chatId - Target chat id.
 * @param expected - The value `active_stream_id` must currently hold (null to
 *   require an unset slot).
 * @param next - The value to write (null to release the slot).
 */
export async function compareAndSetChatActiveStreamId(
  chatId: string,
  expected: string | null,
  next: string | null,
): Promise<CasChatActiveStreamIdResult> {
  const result = await updateChat(
    { id: chatId, where: { active_stream_id: expected } },
    { active_stream_id: next },
  );

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, claimed: result.rowsUpdated > 0 };
}
