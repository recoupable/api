/**
 * One probe of an `audio_url`: a `HEAD`, or a one-byte ranged `GET` for hosts
 * that reject `HEAD`. The request is cut off at `deadline` (epoch ms) so the
 * caller can spread one budget across both probes.
 *
 * @param url - The audio URL to probe.
 * @param method - `HEAD` first; `GET` as the fallback.
 * @param deadline - Epoch milliseconds after which the request is aborted.
 * @returns The fetch response; rejects on network failure or timeout.
 */
export function probeAudioUrl(
  url: string,
  method: "HEAD" | "GET",
  deadline: number,
): Promise<Response> {
  const remaining = Math.max(1, deadline - Date.now());
  return fetch(url, {
    method,
    signal: AbortSignal.timeout(remaining),
    ...(method === "GET" ? { headers: { Range: "bytes=0-0" } } : {}),
  });
}
