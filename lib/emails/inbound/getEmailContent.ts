import { getResendClient } from "@/lib/emails/client";

/**
 * Fetches the email content (text/HTML) from Resend's Receiving API.
 * Webhooks do not include the actual email body, so this must be called separately.
 *
 * @param emailId - The email ID from the Resend webhook event
 * @returns The email text content (prefers plain text over HTML), or empty string if not available
 * @throws Error if the email content cannot be fetched
 */
export async function getEmailContent(emailId: string): Promise<string> {
  const resend = getResendClient();
  const { data: emailContent } = await resend.emails.receiving.get(emailId);

  if (!emailContent) {
    throw new Error("Failed to fetch email content from Resend");
  }

  // Extract text or HTML content, preferring text for cleaner processing
  return emailContent.text || emailContent.html || "";
}
