/**
 * Download a file the caller published by URL.
 *
 * @param url - Public file URL.
 * @returns The bytes.
 */
export async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not fetch ${url}: ${response.status}`);
  return response.arrayBuffer();
}
