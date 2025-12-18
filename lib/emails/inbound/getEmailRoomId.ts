import type { GetReceivingEmailResponseSuccess } from "resend";
import selectMemoryEmails from "@/lib/supabase/memory_emails/selectMemoryEmails";

/**
 * Extracts the roomId from an email's references header by looking up existing memory_emails.
 *
 * @param emailContent - The email content from Resend's Receiving API
 * @returns The roomId if found, undefined otherwise
 */
export async function getEmailRoomId(
  emailContent: GetReceivingEmailResponseSuccess,
): Promise<string | undefined> {
  const references = emailContent.headers?.references;
  if (!references) {
    return undefined;
  }

  const messageIds = JSON.parse(references);
  const existingMemoryEmails = await selectMemoryEmails({ messageIds });

  return existingMemoryEmails[0]?.memories?.room_id;
}
