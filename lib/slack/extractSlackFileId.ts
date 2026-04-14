/**
 * Extract Slack File Id.
 *
 * @param url - Parameter.
 * @returns - Result.
 */
export function extractSlackFileId(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    // parts[1] is "TEAMID-FILEID-HASH" or "TEAMID-FILEID"
    if (parts.length >= 2) {
      const segments = parts[1].split("-");
      // File ID is the second segment (e.g. F0APMKTKG9M)
      if (segments.length >= 2) {
        return segments[1];
      }
    }
  } catch {
    // ignore
  }
  return null;
}
