import {
  ABANDONED_CHECKOUT_EMAIL_LOG_TYPE,
  TRIAL_ENDING_EMAIL_LOG_TYPE,
  WELCOME_EMAIL_LOG_TYPE,
} from "@/lib/const";
import { selectEmailSendLog } from "@/lib/supabase/email_send_log/selectEmailSendLog";

const LIFECYCLE_MARKERS = [
  WELCOME_EMAIL_LOG_TYPE,
  ABANDONED_CHECKOUT_EMAIL_LOG_TYPE,
  TRIAL_ENDING_EMAIL_LOG_TYPE,
].map(type => `"type":"${type}"`);

/**
 * How many emails the account received from its agents since a point in
 * time: every sent row except the three lifecycle sends (welcome, abandoned
 * checkout, trial ending). Product emails such as valuation reports count.
 */
export async function countReportsSent(accountId: string, createdAfter: string): Promise<number> {
  const rows = await selectEmailSendLog({ accountId, status: "sent", createdAfter });
  return rows.filter(row => !LIFECYCLE_MARKERS.some(m => (row.raw_body ?? "").includes(m))).length;
}
