import { selectAccountByEmail } from "@/lib/supabase/account_emails/selectAccountByEmail";
import { insertAccount } from "@/lib/supabase/accounts/insertAccount";
import { insertAccountEmail } from "@/lib/supabase/account_emails/insertAccountEmail";
import { initializeAccountCredits } from "@/lib/credits/initializeAccountCredits";
import { assignAccountToOrg } from "@/lib/organizations/assignAccountToOrg";

/**
 * Resolves an email address to an account ID, creating the account if it
 * does not exist yet (so members can be invited before their first sign-in).
 *
 * New accounts follow the same setup as POST /api/accounts: link the email,
 * seed credits, and auto-assign to an organization by email domain.
 *
 * @param email - The email address to resolve
 * @returns The account ID, or null if the account could not be fully created.
 *   Any setup failure returns null: without the email link the account would
 *   be orphaned (unfindable on the next call), so the caller must not treat
 *   the account as created.
 */
export async function getOrCreateAccountByEmail(email: string): Promise<string | null> {
  try {
    const existing = await selectAccountByEmail(email);
    if (existing?.account_id) {
      return existing.account_id;
    }

    const newAccount = await insertAccount({ name: "" });

    const emailLink = await insertAccountEmail(newAccount.id, email);
    if (!emailLink) {
      console.error(
        "[ERROR] getOrCreateAccountByEmail: failed to link email to account",
        newAccount.id,
      );
      return null;
    }

    await initializeAccountCredits(newAccount.id);
    await assignAccountToOrg(newAccount.id, email);

    return newAccount.id;
  } catch (error) {
    console.error("[ERROR] getOrCreateAccountByEmail:", error);
    return null;
  }
}
