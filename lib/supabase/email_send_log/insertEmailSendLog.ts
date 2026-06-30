import supabase from "../serverClient";
import type { Database } from "@/types/database.types";
import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Inserts one row into `email_send_log`. Best-effort: returns the Supabase error
 * rather than throwing, so a logging failure never affects the email send.
 *
 * @param row - The email_send_log insert payload.
 * @returns `{ error }` — null on success.
 */
export async function insertEmailSendLog(
  row: Database["public"]["Tables"]["email_send_log"]["Insert"],
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase.from("email_send_log").insert(row);
  return { error };
}
