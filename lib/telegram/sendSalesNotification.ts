import { sendMessage } from "./sendMessage";
import { isTestEmail } from "@/lib/emails/isTestEmail";

interface SalesNotificationParams {
  /** Customer email when known — used to filter internal/test accounts. */
  email: string | null;
  /** Fully formatted message body. */
  text: string;
}

/**
 * Sends a sales-event message (new subscription, churn, payment) to the
 * admin Telegram chat. Skips internal/test accounts and never throws —
 * a Telegram failure must not turn a Stripe webhook delivery into a
 * non-200 (Stripe would retry and duplicate work).
 */
export const sendSalesNotification = async ({
  email,
  text,
}: SalesNotificationParams): Promise<void> => {
  if (email && isTestEmail(email)) return;

  try {
    await sendMessage(text);
  } catch (error) {
    console.error("Error sending sales notification:", error);
  }
};
