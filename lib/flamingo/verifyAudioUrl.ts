/** How long the whole check may take, HEAD and fallback GET together. */
export const AUDIO_URL_TIMEOUT_MS = 10_000;

/** Why an `audio_url` was refused; the `error` codes documented on the 422. */
export type AudioUrlError = "audio_url_unreachable" | "audio_url_not_audio";

export type AudioUrlVerification =
  | { ok: true; contentType: string }
  | { ok: false; error: AudioUrlError; message: string };

const ACCEPTED_CONTENT_TYPES = ["application/octet-stream"];

function isAudioContentType(contentType: string): boolean {
  return contentType.startsWith("audio/") || ACCEPTED_CONTENT_TYPES.includes(contentType);
}

function probe(url: string, method: "HEAD" | "GET", deadline: number): Promise<Response> {
  const remaining = Math.max(1, deadline - Date.now());
  return fetch(url, {
    method,
    signal: AbortSignal.timeout(remaining),
    ...(method === "GET" ? { headers: { Range: "bytes=0-0" } } : {}),
  });
}

/**
 * Checks that `audio_url` points at audio before any Modal container starts
 * (recoupable/app#2061). A HEAD first; hosts that reject HEAD get a one-byte
 * ranged GET. The URL must answer 2xx within `AUDIO_URL_TIMEOUT_MS` with an
 * `audio/*` or `application/octet-stream` content type. Never throws: any
 * network failure is an `audio_url_unreachable` result.
 *
 * @param url - The audio URL from the validated request body.
 * @returns The content type seen, or the documented error code and message.
 */
export async function verifyAudioUrl(url: string): Promise<AudioUrlVerification> {
  const deadline = Date.now() + AUDIO_URL_TIMEOUT_MS;
  let response: Response;
  try {
    response = await probe(url, "HEAD", deadline);
    if (!response.ok) {
      response = await probe(url, "GET", deadline);
      await response.body?.cancel();
    }
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      ok: false,
      error: "audio_url_unreachable",
      message: timedOut
        ? `audio_url did not answer within ${AUDIO_URL_TIMEOUT_MS / 1000} seconds`
        : "audio_url could not be reached",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: "audio_url_unreachable",
      message: `audio_url answered HTTP ${response.status}`,
    };
  }

  const raw = response.headers.get("content-type");
  const contentType = raw?.split(";")[0].trim().toLowerCase() ?? "";
  if (!contentType) {
    return {
      ok: false,
      error: "audio_url_not_audio",
      message: `audio_url answered ${response.status} with no content type`,
    };
  }
  if (!isAudioContentType(contentType)) {
    return {
      ok: false,
      error: "audio_url_not_audio",
      message: `audio_url answered ${response.status} with content type ${contentType}`,
    };
  }
  return { ok: true, contentType };
}
