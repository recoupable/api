// Recognizes both the legacy .com host (links still in flight) and the
// post-migration .dev host. (?:com|dev) is non-capturing so the UUID stays group 1.
const CHAT_LINK_REGEX = /https:\/\/chat\.recoupable\.(?:com|dev)\/chat\/([0-9a-f-]{36})/i;

/**
 * Extracts the roomId from the email text body by looking for a Recoup chat link.
 *
 * @param text - The email text body
 * @returns The roomId if found, undefined otherwise
 */
export function extractRoomIdFromText(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const match = text.match(CHAT_LINK_REGEX);
  return match?.[1];
}
