import { getOrCreateAccountByEmail } from "@/lib/accounts/getOrCreateAccountByEmail";
import { sendWelcomeEmail } from "@/lib/emails/sendWelcomeEmail";
import { selectAccountByEmailIlike } from "@/lib/supabase/account_emails/selectAccountByEmailIlike";

/**
 * The account a Stripe billing email belongs to (matched case-insensitively,
 * Stripe keeps the casing the buyer typed), created when none exists
 * (same setup as sign-in: email link, seeded credits, org by domain, welcome
 * email). Throws when creation fails so the webhook 500s and Stripe retries.
 */
export async function findOrCreateAccountForCheckout(
  email: string,
): Promise<{ accountId: string; created: boolean }> {
  const existing = await selectAccountByEmailIlike(email);
  if (existing?.account_id) return { accountId: existing.account_id, created: false };

  const accountId = await getOrCreateAccountByEmail(email);
  if (!accountId) throw new Error(`could not create an account for checkout email ${email}`);

  await sendWelcomeEmail({ accountId, email });
  return { accountId, created: true };
}
