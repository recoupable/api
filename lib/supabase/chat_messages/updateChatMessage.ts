import supabase from "@/lib/supabase/serverClient";
import type { Json } from "@/types/database.types";

export interface UpdateChatMessageResult {
  ok: boolean;
  /**
   * Present only when `ok === false`. Kept optional rather than as a
   * discriminated union so callers can read `result.error` without
   * tripping a narrowing edge case in the Next.js 16 type checker
   * (same pattern as `DeductCreditsWithAuditResult`).
   */
  error?: string;
}

/**
 * Replaces the `parts` jsonb column on an existing `chat_messages`
 * row. UPDATE-only — does NOT insert if the row is missing, so the
 * caller must have already persisted the message via
 * `upsertChatMessage` first.
 *
 * Pure supabase wrapper — kept free of any workflow concerns
 * (no `"use step"` directive here). Callers that need durable step
 * semantics wrap this in a `"use step"` function in `lib/chat/`
 * (e.g. `persistAssistantDataPart`). Keeping the step boundary out
 * of the supabase layer matches the rest of the codebase
 * (`upsertChatMessage`, `updateChat`, etc.) — only domain wrappers
 * are step-bound, supabase wrappers stay pure.
 *
 * Use this when a chunk lands AFTER the initial assistant message
 * was already persisted (auto-commit's `data-commit`, future PR data
 * parts, etc.) and you need the chunk to survive page refresh. The
 * existing `upsertChatMessage` uses `onConflict: "id",
 * ignoreDuplicates: true` so a second call would be a no-op — this
 * helper exists specifically to bypass that.
 *
 * Mirrors the UPDATE branch in open-agents'
 * `apps/web/lib/db/sessions.ts:upsertChatMessageScoped` (which uses
 * a single INSERT-then-UPDATE atomic helper; api keeps the two paths
 * separate so the first-insert path remains replay-idempotent).
 */
export async function updateChatMessage(
  id: string,
  parts: unknown,
): Promise<UpdateChatMessageResult> {
  try {
    const { error } = await supabase
      .from("chat_messages")
      .update({ parts: parts as Json })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
