import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Finds a prior successful valuation-report send for a snapshot run, keyed on
 * the `"snapshot_id":"<id>"` marker that sendValuationReportEmail writes into
 * `raw_body`. This is the long-window idempotency guard (Resend's idempotency
 * key only covers 24h): a matching row means the report was already delivered
 * for this run and must not be re-sent.
 *
 * @param snapshotId - The playcount_snapshots run id
 * @returns The matching sent row, or null if none exists or on error
 */
export async function selectValuationEmailSendLog(
  snapshotId: string,
): Promise<Tables<"email_send_log"> | null> {
  const { data, error } = await supabase
    .from("email_send_log")
    .select("*")
    .eq("status", "sent")
    .like("raw_body", `%"snapshot_id":"${snapshotId}"%`)
    .limit(1);

  if (error) {
    console.error("Error fetching email_send_log for snapshot:", error);
    return null;
  }

  return data?.[0] ?? null;
}
