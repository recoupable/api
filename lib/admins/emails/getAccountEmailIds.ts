import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { getResendClient } from "@/lib/emails/client";

/**
 * Returns Resend email IDs for all emails sent to a given account's email address
 * by listing recent emails from Resend and filtering by recipient.
 *
 * @param accountId - The account ID to look up emails for
 * @returns Array of Resend email ID strings
 */
export async function getAccountEmailIds(
  accountId: string,
): Promise<string[]> {
  const emailRows = await selectAccountEmails({ accountIds: accountId });
  const accountEmail = emailRows.find((r) => r.email)?.email;

  if (!accountEmail) return [];

  const resend = getResendClient();
  const { data } = await resend.emails.list({ limit: 100 });

  if (!data?.data) return [];

  return data.data
    .filter((email) => email.to.includes(accountEmail))
    .map((email) => email.id);
}
