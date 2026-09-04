import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { RECOUP_FROM_EMAIL } from "@/lib/const";

type AutoTopUpEmail =
  | { accountId: string; kind: "receipt"; amountCents: number }
  | { accountId: string; kind: "declined"; amountCents: number; message: string };

const BILLING_URL = "https://app.recoupable.dev/billing";

/**
 * Receipt after a successful auto top-up, or the notice that a decline turned
 * auto top-up off. Silent when the account has no email on file.
 */
export async function sendAutoTopUpEmail(params: AutoTopUpEmail): Promise<void> {
  const rows = await selectAccountEmails({ accountIds: params.accountId });
  const to = rows[0]?.email;
  if (!to) {
    console.warn(`[sendAutoTopUpEmail] no email for account ${params.accountId}`);
    return;
  }

  const amount = `$${(params.amountCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const { subject, html } =
    params.kind === "receipt"
      ? {
          subject: `Recoup receipt: ${amount} credits top-up`,
          html: `<p>Your balance dropped below the threshold you set, so we charged the card on file ${amount} and added the credits to your account.</p><p>Change the amount or turn auto top-up off any time at <a href="${BILLING_URL}">${BILLING_URL}</a>.</p>`,
        }
      : {
          subject: "Recoup auto top-up turned off",
          html: `<p>We tried to charge the card on file ${amount} for an auto top-up and it did not go through: ${params.message}</p><p>Auto top-up is now turned off so the card is not retried. Update the card and turn it back on at <a href="${BILLING_URL}">${BILLING_URL}</a>.</p>`,
        };

  await sendEmailWithResend({ from: RECOUP_FROM_EMAIL, to, subject, html });
}
