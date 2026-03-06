/**
 * Extracts username from a profile URL by pulling text after .com/ or .net/ until ? or /
 *
 * @param profileUrl - The profile URL to extract username from
 * @returns The username or empty string if unable to extract
 */
export const getUsernameFromProfileUrl = (profileUrl: string | null | undefined): string => {
  if (!profileUrl) {
    return "";
  }

  try {
    const trimmedUrl = profileUrl.trim();
    const match = trimmedUrl.match(/(?:\.com|\.net)\/([^/?]+)/i);
    if (!match) {
      return "";
    }
    // Strip leading @ (e.g. instagram.com/@handle → handle)
    return match[1].replace(/^@/, "");
  } catch (error) {
    console.error("[ERROR] Error extracting username from profile URL:", error);
    return "";
  }
};
