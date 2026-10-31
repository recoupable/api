import { downloadMediaBuffer } from "./downloadMediaBuffer";

/**
 * Downloads a video from a URL and returns the data as a Buffer.
 *
 * @param url - The video URL to download
 * @returns The video data as a Buffer, or null if the download fails
 */
export async function downloadVideoBuffer(url: string): Promise<Buffer | null> {
  return (await downloadMediaBuffer(url))?.buffer ?? null;
}
