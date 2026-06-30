import supabase from "../serverClient";
import type { Database } from "@/types/database.types";

/**
 * Inserts one row into `email_send_log`. Best-effort: callers should not let a
 * logging failure affect the email send, so errors are returned, never thrown.
 *
 * @param row - The email_send_log insert payload.
 * @returns `{ error }` — null on success.
 */
export async function insertEmailSendLog(
  row: Database["public"]["Tables"]["email_send_log"]["Insert"],
): Promise<{ error: unknown }> {
  const { error } = await supabase.from("email_send_log").insert(row);
  return { error };
}
