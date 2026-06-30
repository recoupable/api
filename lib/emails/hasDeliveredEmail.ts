import { countDeliveredEmails } from "@/lib/supabase/email_send_log/countDeliveredEmails";

/**
 * Whether a chat/run delivered at least one non-empty email (per
 * `email_send_log`). The building block for the "verify-the-send" guarantee:
 * a report task that completes without a delivered email should be flagged
 * rather than reported as a silent success.
 *
 * @param chatId - The chat/run id.
 * @returns true if ≥1 'sent' email is logged for the chat.
 */
export async function hasDeliveredEmail(chatId: string): Promise<boolean> {
  return (await countDeliveredEmails(chatId)) > 0;
}
