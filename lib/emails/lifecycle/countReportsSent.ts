import { selectEmailSendLog } from "@/lib/supabase/email_send_log/selectEmailSendLog";

/**
 * How many emails the account's agents sent since a point in time. Rows
 * written by lifecycle senders (welcome, trial, abandoned checkout) start
 * with a `{"type":"` marker and are excluded, so the number is the
 * customer's own reports.
 */
export async function countReportsSent(accountId: string, createdAfter: string): Promise<number> {
  const rows = await selectEmailSendLog({ accountId, status: "sent", createdAfter });
  return rows.filter(row => !(row.raw_body ?? "").startsWith('{"type":"')).length;
}
