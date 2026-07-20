import supabase from "../serverClient";
import { WELCOME_EMAIL_LOG_TYPE } from "@/lib/const";

/**
 * Looks up a previously *sent* welcome email for an account in
 * `email_send_log` (identified by the `"type":"welcome_email"` marker in
 * `raw_body`). Used as the idempotency guard so a welcome email is never
 * sent twice to the same account. Failed attempts don't match, so a
 * `send_failed` welcome can be retried.
 *
 * @param accountId - The account to check.
 * @returns The matching log row id, or null when none exists (or on error).
 */
export async function selectWelcomeEmailLog(accountId: string): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("email_send_log")
    .select("id")
    .eq("account_id", accountId)
    .eq("status", "sent")
    .like("raw_body", `%"type":"${WELCOME_EMAIL_LOG_TYPE}"%`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching welcome email log:", error);
    return null;
  }

  return data ?? null;
}
