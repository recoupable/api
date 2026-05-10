import { getEmailByAuthToken } from "./getEmailByAuthToken";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

/**
 * Get account ID from Privy auth token. Verifies the token, resolves
 * the user's email, and looks up the corresponding `account_id` in
 * `account_emails`. Throws `"No account found for this email"` when
 * no row exists — callers that should auto-provision instead should
 * use `getOrCreateAccountIdByAuthToken`.
 *
 * @param authToken - The Privy authentication token
 * @returns The account ID from the account_emails table
 */
export async function getAccountIdByAuthToken(authToken: string): Promise<string> {
  const email = await getEmailByAuthToken(authToken);

  const accountEmails = await selectAccountEmails({ emails: [email] });
  if (!accountEmails || accountEmails.length === 0) {
    throw new Error("No account found for this email");
  }

  const accountId = accountEmails[0].account_id;
  if (!accountId) {
    throw new Error("Account ID not found in account_emails");
  }

  return accountId;
}
