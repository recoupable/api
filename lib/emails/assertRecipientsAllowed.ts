import { accountHasPaymentMethod } from "@/lib/emails/accountHasPaymentMethod";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

export type RecipientCheckResult = { allowed: true } | { allowed: false; disallowed: string[] };

/**
 * Enforces the POST /api/emails recipient restriction: without a payment method
 * on file, an account may only send to its own email address(es). Once a card
 * is on file (a prior subscription or credits top-up), any recipient is allowed.
 *
 * Matches the documented contract (docs#251): `to`/`cc` are "restricted to the
 * account's own email unless a payment method is on file".
 *
 * @param accountId The authenticated account (validated UUID upstream).
 * @param recipients The combined `to` + `cc` list to check.
 * @returns `{ allowed: true }` or `{ allowed: false, disallowed }` listing the
 *   recipients that are not the account's own email.
 */
export async function assertRecipientsAllowed({
  accountId,
  recipients,
}: {
  accountId: string;
  recipients: string[];
}): Promise<RecipientCheckResult> {
  if (await accountHasPaymentMethod(accountId)) {
    return { allowed: true };
  }

  const ownRows = await selectAccountEmails({ accountIds: accountId });
  const ownEmails = new Set(ownRows.map(row => row.email.toLowerCase()));

  const disallowed = recipients.filter(email => !ownEmails.has(email.toLowerCase()));

  if (disallowed.length > 0) {
    return { allowed: false, disallowed };
  }

  return { allowed: true };
}
