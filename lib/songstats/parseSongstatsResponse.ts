/**
 * Parses a SongStats response as JSON when possible, otherwise as raw text.
 */
export async function parseSongstatsResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json();

  const text = await response.text();
  return text ? { raw: text } : null;
}
