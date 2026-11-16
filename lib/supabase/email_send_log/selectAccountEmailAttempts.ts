import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Every `email_send_log` row for an account since a moment. Unlike
 * `selectEmailSendLog`, a read error throws: a caller deciding whether a
 * report was sent must not mistake "unknown" for "nothing sent".
 *
 * @param params - The account and the inclusive ISO lower bound.
 * @param params.accountId - The sending account.
 * @param params.since - Inclusive lower bound on `created_at`.
 * @returns The account's send attempts since then.
 */
export async function selectAccountEmailAttempts({
  accountId,
  since,
}: {
  accountId: string;
  since: string;
}): Promise<Tables<"email_send_log">[]> {
  const { data, error } = await supabase
    .from("email_send_log")
    .select("*")
    .eq("account_id", accountId)
    .gte("created_at", since);
  if (error) throw new Error(`Failed to read email_send_log: ${error.message}`);
  return data ?? [];
}
