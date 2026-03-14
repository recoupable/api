import type { FilePart } from "ai";

/**
 * Parses files from a query parameter string.
 * Format: files=url1:type1|url2:type2
 * Example: files=https://example.com/image.png:image/png|https://example.com/file.jpg:image/jpeg
 *
 * @param filesParam - The files query parameter string
 * @returns Array of FilePart objects
 * @throws Error if the format is invalid
 */
export function parseFilesFromQuery(filesParam: string | null): FilePart[] {
  if (!filesParam) {
    return [];
  }

  const fileEntries = filesParam.split("|");
  return fileEntries
    .map(entry => {
      // Split on last ":" to handle URLs with colons (e.g., https://)
      const lastColonIndex = entry.lastIndexOf(":");
      if (lastColonIndex === -1) {
        throw new Error(`Invalid file entry: "${entry}". Format must be "url:mediaType"`);
      }
      const data = entry.substring(0, lastColonIndex).trim();
      const mediaType = entry.substring(lastColonIndex + 1).trim();
      if (!data || !mediaType) {
        throw new Error(`Invalid file entry: "${entry}". Format must be "url:mediaType"`);
      }
      return {
        type: "file" as const,
        data: decodeURIComponent(data),
        mediaType: mediaType,
      };
    })
    .filter(file => file.data && file.mediaType);
}
