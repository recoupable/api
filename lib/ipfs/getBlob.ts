/**
 * Fetches a remote image as a Blob and returns the resolved MIME type.
 *
 * @param imageUrl - HTTPS URL of the image to fetch.
 * @returns The blob and its content type.
 */
export async function getBlob(imageUrl: string): Promise<{ blob: Blob; type: string }> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }
  const type = response.headers.get("content-type") || "";
  const blob = await response.blob();
  return { blob, type };
}
