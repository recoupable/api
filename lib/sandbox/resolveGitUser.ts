import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";

interface GitUser {
  name: string;
  email: string;
}

/**
 * Resolves the per-account `gitUser` identity that the sandbox should
 * use for `git config user.name` / `user.email`. Driven by:
 *   - `accounts.name` for the display name
 *   - `account_emails.email` for the address
 *
 * When either field is missing, falls back to a synthetic value derived
 * from the account id. This keeps commit attribution consistent across
 * sandbox restores without leaking PII when the account row is sparse.
 *
 * Note: this controls *commit authorship* only. The push credential
 * (the GitHub token) is a single hardcoded service token issued via
 * `getServiceGithubToken` and is unrelated.
 *
 * @param accountId - The authenticated account id.
 * @returns A `{ name, email }` pair safe to pass to `connectSandbox`.
 */
export async function resolveGitUser(accountId: string): Promise<GitUser> {
  const [accounts, emails] = await Promise.all([
    selectAccounts(accountId),
    selectAccountEmails({ accountIds: accountId }),
  ]);

  const account = accounts[0] ?? null;
  const emailRow = emails.find(row => typeof row.email === "string" && row.email.length > 0);

  const name = account?.name?.trim() || `recoupable-${accountId.slice(0, 8)}`;
  const email = emailRow?.email ?? `${accountId}@users.noreply.recoupable.dev`;

  return { name, email };
}
