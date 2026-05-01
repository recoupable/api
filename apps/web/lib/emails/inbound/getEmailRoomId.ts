import type { GetReceivingEmailResponseSuccess } from "resend";
import selectMemoryEmails from "@/lib/supabase/memory_emails/selectMemoryEmails";
import { extractRoomIdFromText } from "./extractRoomIdFromText";
import { extractRoomIdFromHtml } from "./extractRoomIdFromHtml";

/**
 * Extracts the roomId from an email. Checks multiple sources in order:
 * 1. Email text body for a Recoup chat link
 * 2. Email HTML body for a Recoup chat link (handles Superhuman's wbr tags)
 * 3. References header to look up existing memory_emails
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

  // Secondary: check email HTML for Recoup chat link
  // This handles clients like Superhuman that insert <wbr /> tags in link text
  const roomIdFromHtml = extractRoomIdFromHtml(emailContent.html);
  if (roomIdFromHtml) {
    return roomIdFromHtml;
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
