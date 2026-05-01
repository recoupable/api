export interface SlackFile {
  id: string;
  name?: string;
  mimetype?: string;
  permalink?: string;
}

/**
 * Extracts video permalinks from Slack message file attachments.
 * Filters for video MIME types and deduplicates results.
 *
 * @param files - Array of Slack file objects from a message
 * @returns Array of unique video permalink URLs
 */
export function extractVideoFiles(files?: SlackFile[]): string[] {
  if (!files) return [];

  const urls = files
    .filter(f => f.mimetype?.startsWith("video/") && f.permalink)
    .map(f => f.permalink!);

  return [...new Set(urls)];
}
