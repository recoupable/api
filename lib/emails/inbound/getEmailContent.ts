import { getResendClient } from "@/lib/emails/client";
import { GetReceivingEmailResponseSuccess } from "resend";

/**
 * Fetches the full email content from Resend's Receiving API.
 * Webhooks do not include the actual email body, so this must be called separately.
 *
 * @param emailId - The email ID from the Resend webhook event
 * @returns The full email content object from Resend
 * @throws Error if the email content cannot be fetched
 */
export async function getEmailContent(emailId: string): Promise<GetReceivingEmailResponseSuccess> {
  const resend = getResendClient();
  const { data: emailContent } = await resend.emails.receiving.get(emailId);

  if (!emailContent) {
    throw new Error("Failed to fetch email content from Resend");
  }

  return emailContent;
}
