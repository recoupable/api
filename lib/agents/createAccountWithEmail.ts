import { insertAccount } from "@/lib/supabase/accounts/insertAccount";
import { insertAccountEmail } from "@/lib/supabase/account_emails/insertAccountEmail";
import { insertCreditsUsage } from "@/lib/supabase/credits_usage/insertCreditsUsage";
import { assignAccountToOrg } from "@/lib/organizations/assignAccountToOrg";

/**
 * Creates a new account row and wires up its email, credits usage, and org
 * membership. Used by the agent signup flow.
 *
 * @param email - Email to associate with the new account
 * @returns The new account ID
 */
export async function createAccountWithEmail(email: string): Promise<string> {
  const account = await insertAccount({});
  await insertAccountEmail(account.id, email);
  await insertCreditsUsage(account.id);
  await assignAccountToOrg(account.id, email);
  return account.id;
}
