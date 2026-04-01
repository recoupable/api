/**
 * Downloads a video from a URL and returns the data as a Buffer.
 *
 * @param url - The video URL to download
 * @returns The video data as a Buffer, or null if the download fails
 */
export async function downloadVideoBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Failed to download video: HTTP ${response.status} from ${url}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("Failed to download video:", error);
    return null;
  }
}
