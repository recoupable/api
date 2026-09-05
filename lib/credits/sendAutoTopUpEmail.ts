import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { escapeHtml } from "@/lib/emails/escapeHtml";
import { RECOUP_FROM_EMAIL } from "@/lib/const";
import { CREDIT_BILLING_URL } from "@/lib/credits/const";

type AutoTopUpEmail =
  | { accountId: string; kind: "receipt"; amountCents: number; card?: ChargedCard }
  | {
      accountId: string;
      kind: "declined";
      amountCents: number;
      message: string;
      card?: ChargedCard;
    };

export interface ChargedCard {
  brand: string;
  last4: string;
}

/** "your Mastercard ending in 3800", or "the card on file" when unknown. */
const describeCard = (card?: ChargedCard): string =>
  card
    ? `your ${card.brand.charAt(0).toUpperCase()}${card.brand.slice(1)} ending in ${escapeHtml(card.last4)}`
    : "the card on file";

const BILLING_URL = `${CREDIT_BILLING_URL}/billing`;

/** The account's most recently updated non-empty email, or null. */
function pickRecipient(rows: { email: string | null; updated_at?: string }[]): string | null {
  const withEmail = rows.filter(r => r.email);
  withEmail.sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
  return withEmail[0]?.email ?? null;
}

/**
 * Receipt after a successful auto top-up charge (the credits land via the
 * payment_intent.succeeded webhook moments later), or the notice that a
 * decline turned auto top-up off. Silent when the account has no email.
 */
export async function sendAutoTopUpEmail(params: AutoTopUpEmail): Promise<void> {
  const to = pickRecipient(await selectAccountEmails({ accountIds: params.accountId }));
  if (!to) {
    console.warn(`[sendAutoTopUpEmail] no email for account ${params.accountId}`);
    return;
  }

  const amount = `$${(params.amountCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const { subject, html } =
    params.kind === "receipt"
      ? {
          subject: `Recoup receipt: ${amount} credits top-up`,
          html: `<p>Your balance dropped below the threshold you set, so we charged ${describeCard(params.card)} ${amount}. The credits will appear on your balance shortly.</p><p>Change the amount or turn auto top-up off any time at <a href="${BILLING_URL}">${BILLING_URL}</a>.</p>`,
        }
      : {
          subject: "Recoup auto top-up turned off",
          html: `<p>We tried to charge ${describeCard(params.card)} ${amount} for an auto top-up and it did not go through: ${escapeHtml(params.message)}</p><p>Auto top-up is now turned off so the card is not retried. Update the card and turn it back on at <a href="${BILLING_URL}">${BILLING_URL}</a>.</p>`,
        };

  await sendEmailWithResend({ from: RECOUP_FROM_EMAIL, to, subject, html });
}
