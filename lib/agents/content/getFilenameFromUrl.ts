/**
 * Extracts the filename from a URL path, using the supplied fallback when needed.
 *
 * @param url - The media URL
 * @param fallback - Filename to use if the URL has no filename with an extension.
 * @returns The extracted filename
 */
export function getFilenameFromUrl(url: string, fallback = "video.mp4"): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/");
    const last = segments[segments.length - 1];
    return last && last.includes(".") ? last : fallback;
  } catch {
    return fallback;
  }
}
