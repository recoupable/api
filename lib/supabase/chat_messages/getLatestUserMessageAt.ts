import supabase from "@/lib/supabase/serverClient";

/**
 * Return the ISO `created_at` of an account owner's most recent `role='user'`
 * chat message, or `null` if they've never sent one (or on DB error — callers
 * treat "unknown" as "no recent human activity", which is the safe default for
 * an alert-only signal).
 *
 * Walks `chat_messages → chats → sessions` via PostgREST inner embeds and
 * filters on `sessions.account_id`, so it counts only messages the owner
 * actually authored across their own sessions. Used by the zombie-owner alert
 * (recoupable/chat#1885) to detect accounts whose scheduled runs keep firing
 * long after the human stopped engaging.
 */
export async function getLatestUserMessageAt(accountId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("created_at, chats!inner(sessions!inner(account_id))")
    .eq("role", "user")
    .eq("chats.sessions.account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[getLatestUserMessageAt] error:", error);
    return null;
  }

  return data?.created_at ?? null;
}
