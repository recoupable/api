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

  // References header is space/newline separated list of message IDs (not JSON)
  // e.g., "<id1@domain> <id2@domain>"
  const messageIds = references.split(/\s+/).filter(id => id.length > 0);
  const existingMemoryEmails = await selectMemoryEmails({ messageIds });

  return existingMemoryEmails[0]?.memories?.room_id;
}
