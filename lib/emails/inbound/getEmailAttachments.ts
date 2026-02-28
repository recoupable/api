import { getResendClient } from "@/lib/emails/client";

export interface EmailAttachment {
  id: string;
  filename: string;
  contentType: string;
  downloadUrl: string;
}

/**
 * Fetches attachment download URLs for a received email from Resend.
 * Webhooks only include attachment metadata (id, filename, content_type),
 * so this calls the Attachments API to get download URLs.
 *
 * @param emailId - The email ID from the Resend webhook event
 * @returns Array of attachments with download URLs (empty if none)
 */
export async function getEmailAttachments(emailId: string): Promise<EmailAttachment[]> {
  const resend = getResendClient();
  const { data } = await resend.emails.receiving.attachments.list({ emailId });

  if (!data?.data?.length) return [];

  return data.data.map(att => ({
    id: att.id,
    filename: att.filename || "attachment",
    contentType: att.content_type,
    downloadUrl: att.download_url,
  }));
}
