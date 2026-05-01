/**
 * Downloads file content from a URL.
 *
 * @param url - The URL to download from
 * @returns The file content as a Buffer, or an error string
 */
export async function downloadFile(url: string): Promise<Buffer | { error: string }> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { error: `Failed to download: ${response.status}` };
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    return { error: `Download error: ${err instanceof Error ? err.message : String(err)}` };
  }
}
