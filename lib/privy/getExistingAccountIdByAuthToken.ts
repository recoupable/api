import type { CredentialObserver } from "@/lib/auth/VerificationEvidence";
import { getEmailByAuthToken } from "./getEmailByAuthToken";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

/**
 * Resolves an already-onboarded account using the existing Privy identity check.
 * Does not create accounts or send welcome emails when no account matches.
 *
 * @param authToken - Privy authentication token
 * @returns Existing account ID, or null when none is found
 */
export async function getExistingAccountIdByAuthToken(
  authToken: string,
  onVerified?: CredentialObserver,
): Promise<string | null> {
  const email = onVerified
    ? await getEmailByAuthToken(authToken, onVerified)
    : await getEmailByAuthToken(authToken);
  const accounts = await selectAccountEmails({ emails: [email] });
  return accounts[0]?.account_id ?? null;
}
