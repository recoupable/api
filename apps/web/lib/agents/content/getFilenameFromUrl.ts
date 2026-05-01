/**
 * Extracts the filename from a URL path, falling back to "video.mp4".
 *
 * @param url - The video URL
 * @returns The extracted filename
 */
export function getFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/");
    const last = segments[segments.length - 1];
    return last && last.includes(".") ? last : "video.mp4";
  } catch {
    return "video.mp4";
  }
}
