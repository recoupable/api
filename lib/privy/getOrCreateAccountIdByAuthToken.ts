import { getEmailByAuthToken } from "./getEmailByAuthToken";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { createAccountWithEmail } from "@/lib/agents/createAccountWithEmail";

/**
 * Get account ID from a Privy auth token, creating an account on the fly
 * if no row exists for the user's email yet. Mirrors `getAccountIdByAuthToken`
 * but treats "no account found" as a signal to provision rather than fail.
 *
 * Used by `GET /api/accounts/id` so that brand-new Privy users (e.g. fresh
 * sign-ins on open-agents) get a stable `accountId` on their first request
 * instead of bouncing on a 401.
 *
 * @param authToken - The Privy authentication token
 * @returns The account ID — either existing or newly-created
 */
export async function getOrCreateAccountIdByAuthToken(authToken: string): Promise<string> {
  const email = await getEmailByAuthToken(authToken);

  const accountEmails = await selectAccountEmails({ emails: [email] });
  const existingAccountId = accountEmails?.[0]?.account_id;
  if (existingAccountId) {
    return existingAccountId;
  }

  return createAccountWithEmail(email);
}
