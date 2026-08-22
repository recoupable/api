import fal from "@/lib/fal/server";
import { MUSIC_MODEL } from "@/lib/music/const";
import { toLogEntries, type MusicLogEntry } from "@/lib/music/toLogEntries";

/**
 * Read a generation's progress log from fal, the system that produced it.
 *
 * Fetched live rather than stored: fal already keeps this, and copying it into
 * our own column meant a second source of truth that could disagree, plus a
 * cap to stop the row growing (recoupable/chat#1992). What comes back is the
 * model's real denoising progress, which is richer than anything we were
 * writing ourselves.
 *
 * Never throws. Logs are a diagnostic extra on a read whose primary job is the
 * generation itself, so a fal outage returns an empty timeline instead of
 * failing a request that would otherwise have succeeded.
 *
 * @param falRequestId - The stored fal request id; null before submit.
 * @returns The timeline, oldest first. Empty when unavailable.
 */
export async function fetchMusicLogs(falRequestId: string | null): Promise<MusicLogEntry[]> {
  if (!falRequestId) return [];

  try {
    const status = await fal.queue.status(MUSIC_MODEL, {
      requestId: falRequestId,
      logs: true,
    });

    return toLogEntries((status as { logs?: unknown }).logs);
  } catch (error) {
    console.error("Error fetching music generation logs:", error);
    return [];
  }
}
