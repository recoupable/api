import { FatalError, RetryableError } from "workflow";
/** Classify status without reading credential-bearing error bodies. */
export async function checkLuminateRecordingResponse(response: Response) {
  if (response.ok) return true;
  await response.body?.cancel();
  if (response.status === 404) return false;
  if (response.status === 429 || response.status >= 500) {
    const seconds = Number(response.headers.get("retry-after"));
    throw new RetryableError("Luminate temporarily unavailable", {
      retryAfter: `${Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 300) : 60}s`,
    });
  }
  throw new FatalError(`Luminate recording unavailable (HTTP ${response.status})`);
}
