interface DownloadedMedia {
  buffer: Buffer;
  mimeType: string | null;
}

/**
 * Downloads callback media using the existing callback's outbound trust boundary.
 *
 * @param url - Media URL supplied by the authenticated content callback.
 * @returns Bytes and reported MIME type, or null when the download fails.
 */
export async function downloadMediaBuffer(url: string): Promise<DownloadedMedia | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to download content media: HTTP ${response.status}`);
      return null;
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType: response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || null,
    };
  } catch (error) {
    console.error("Failed to download content media:", error);
    return null;
  }
}
