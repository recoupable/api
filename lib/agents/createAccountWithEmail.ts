import { insertAccount } from "@/lib/supabase/accounts/insertAccount";
import { insertAccountEmail } from "@/lib/supabase/account_emails/insertAccountEmail";
import { insertCreditsUsage } from "@/lib/supabase/credits_usage/insertCreditsUsage";

/**
 * Creates a new account row and wires up its email link and credits usage
 * row. Used by the unauthenticated agent signup flow.
 *
 * Deliberately does NOT call `assignAccountToOrg`. The org-by-domain
 * assignment is appropriate for human signups (which are gated by Privy
 * email-ownership proof) but is unsafe for the agent path because the
 * agent+ shortcut is unauthenticated and bypasses email verification —
 * an attacker could mint a key auto-joined to any domain-verified org.
 * Org membership for agents must be a deliberate post-signup admin step.
 *
 * Throws on any DB write failure so the caller cannot leak an account
 * that lacks an email link or credits row.
 *
 * @param email - Email to associate with the new account
 * @returns The new account ID
 */
export async function createAccountWithEmail(email: string): Promise<string> {
  const account = await insertAccount({});

  const emailLink = await insertAccountEmail(account.id, email);
  if (!emailLink) {
    throw new Error("createAccountWithEmail: insertAccountEmail returned null");
  }

  const credits = await insertCreditsUsage(account.id);
  if (!credits) {
    throw new Error("createAccountWithEmail: insertCreditsUsage returned null");
  }

  return account.id;
}
