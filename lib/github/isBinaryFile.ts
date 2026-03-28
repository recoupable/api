const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".bmp",
  ".tiff",
  ".pdf",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".mp3",
  ".mp4",
  ".wav",
  ".ogg",
  ".webm",
  ".avif",
]);

/**
 * Determines if a file is binary based on its extension.
 *
 * @param filePath - The file path to check
 * @returns true if the file extension indicates a binary format
 */
export function isBinaryFile(filePath: string): boolean {
  const dotIndex = filePath.lastIndexOf(".");
  if (dotIndex === -1) return false;
  const ext = filePath.slice(dotIndex).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}
