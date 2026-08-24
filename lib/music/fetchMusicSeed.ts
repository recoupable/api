import fal from "@/lib/fal/server";
import { MUSIC_MODEL } from "@/lib/music/const";

/**
 * Read back the seed fal used for a finished generation.
 *
 * Fetched live rather than stored, for the same reason as the logs: fal
 * already holds it, so a column of our own would be a second source of truth
 * (recoupable/chat#1992). The seed is also not knowable at submit time when
 * the caller leaves it blank and fal picks one, so the result is the only
 * place the real value exists.
 *
 * Note this is the only generation parameter fal gives back. Its result
 * payload is `{ audio, seed, duration }` — `num_inference_steps` and
 * `guidance_scale` are consumed at submit and never echoed, on the result, the
 * status, or any other endpoint, so they are deliberately absent from the
 * response rather than stored.
 *
 * Never throws, and never calls fal before there is something to read: a
 * generation still rendering has no seed yet, and the detail read is polled
 * throughout that render.
 *
 * @param falRequestId - The stored fal request id; null before submit.
 * @param status - The generation's stored status.
 * @returns The seed, or null when unfinished, unavailable, or unreadable.
 */
export async function fetchMusicSeed(
  falRequestId: string | null,
  status: string,
): Promise<number | null> {
  if (!falRequestId || status !== "completed") return null;

  try {
    const result = await fal.queue.result(MUSIC_MODEL, { requestId: falRequestId });
    const payload = (result as { data?: unknown }).data ?? result;
    const seed = (payload as { seed?: unknown }).seed;

    return typeof seed === "number" ? seed : null;
  } catch (error) {
    console.error("Error fetching music generation seed:", error);
    return null;
  }
}
