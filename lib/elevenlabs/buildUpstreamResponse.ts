import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Builds a passthrough Response from an upstream ElevenLabs response,
 * forwarding the body stream, content-type, and song-id header.
 *
 * @param upstream - The successful upstream response.
 * @param defaultContentType - Fallback content-type if upstream doesn't set one.
 * @param forwardHeaders - Additional upstream headers to forward (e.g. "content-disposition").
 * @returns A Response that pipes the upstream body through.
 */
export function buildUpstreamResponse(
  upstream: Response,
  defaultContentType: string,
  forwardHeaders: string[] = [],
): Response {
  const contentType = upstream.headers.get("content-type") ?? defaultContentType;
  const songId = upstream.headers.get("song-id");

  const headers: Record<string, string> = {
    ...getCorsHeaders(),
    "Content-Type": contentType,
  };
  if (songId) headers["song-id"] = songId;

  for (const name of forwardHeaders) {
    const value = upstream.headers.get(name);
    if (value) headers[name] = value;
  }

  return new Response(upstream.body, { status: 200, headers });
}
