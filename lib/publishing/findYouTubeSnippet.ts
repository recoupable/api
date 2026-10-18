type Snippet = { title?: string; description?: string };

/**
 * The first item's snippet, wherever the envelope nests `items`.
 *
 * @param details - YOUTUBE_GET_VIDEO_DETAILS_BATCH result.
 * @returns The snippet, or null.
 */
export function findYouTubeSnippet(details: unknown): Snippet | null {
  let current = details;
  for (let depth = 0; depth < 8 && current && typeof current === "object"; depth++) {
    const record = current as Record<string, unknown>;
    if (Array.isArray(record.items)) {
      return (record.items[0] as { snippet?: Snippet })?.snippet ?? null;
    }
    current = record.data ?? record.result ?? record.response;
  }
  return null;
}
