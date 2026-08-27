import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

/**
 * The account as a human reads it in an alert: its email when one is on
 * file, otherwise the id. Never throws — a lookup failure degrades to the id.
 *
 * @param accountId - The account to describe; null/undefined → "unknown".
 */
export async function describeAccountForAlert(
  accountId: string | null | undefined,
): Promise<string> {
  if (!accountId) return "unknown";
  try {
    const [row] = await selectAccountEmails({ accountIds: accountId });
    return row?.email || accountId;
  } catch (error) {
    console.error("[WARN] describeAccountForAlert failed:", error);
    return accountId;
  }
}
