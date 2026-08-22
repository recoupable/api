export type MusicLogEntry = { at: string; message: string };

/**
 * Most recent lines kept. A long generation emits a line per denoising step,
 * which is more than any client needs and more than belongs in one response.
 */
const MAX_LOG_ENTRIES = 200;

/**
 * Normalize fal's queue logs onto the documented `{ at, message }` shape
 * (recoupable/docs#308).
 *
 * fal returns `{ timestamp, message, labels }`; only the first two are
 * contractual. Anything malformed is dropped rather than surfaced, because
 * these are diagnostic extras — a bad log line must never degrade the
 * generation read that carries them.
 *
 * @param falLogs - The `logs` array from fal's queue status response.
 * @returns The timeline, oldest first, capped at the most recent entries.
 */
export function toLogEntries(falLogs: unknown): MusicLogEntry[] {
  if (!Array.isArray(falLogs)) return [];

  const entries: MusicLogEntry[] = [];
  for (const raw of falLogs) {
    if (typeof raw !== "object" || raw === null) continue;
    const { timestamp, message } = raw as Record<string, unknown>;
    if (typeof timestamp !== "string" || typeof message !== "string") continue;
    entries.push({ at: timestamp, message });
  }

  return entries.slice(-MAX_LOG_ENTRIES);
}
