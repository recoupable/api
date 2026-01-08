import type { GetReceivingEmailResponseSuccess } from "resend";
import selectMemoryEmails from "@/lib/supabase/memory_emails/selectMemoryEmails";
import { extractRoomIdFromText } from "./extractRoomIdFromText";

/**
 * Extracts the roomId from an email. First checks the email text for a Recoup chat link,
 * then falls back to looking up existing memory_emails via the references header.
 *
 * @param emailContent - The email content from Resend's Receiving API
 * @returns The roomId if found, undefined otherwise
 */
export async function getEmailRoomId(
  emailContent: GetReceivingEmailResponseSuccess,
): Promise<string | undefined> {
  // Primary: check email text for Recoup chat link
  const roomIdFromText = extractRoomIdFromText(emailContent.text);
  if (roomIdFromText) {
    return roomIdFromText;
  }

  // Fallback: check references header for existing memory_emails
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
