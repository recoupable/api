import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Select a single session row by its id, or null if not found.
 * Caller is responsible for any ownership / access-control checks.
 *
 * @param sessionId - The id of the session to fetch.
 * @returns The session row, or null when no row matches.
 */
export async function selectSession(sessionId: string): Promise<Tables<"sessions"> | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    console.error(`[selectSession] error for sessionId=${sessionId}:`, error);
    return null;
  }

  return data ?? null;
}
