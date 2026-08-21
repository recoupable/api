import type { Json } from "@/types/database.types";

export type MusicLogEntry = { at: string; message: string };

/**
 * Most recent lines kept. The poll loop writes a line per check, so an
 * unusually slow generation would otherwise grow the row indefinitely.
 */
const MAX_LOG_ENTRIES = 200;

/**
 * Append one line to a generation's workflow timeline.
 *
 * Tolerates a null or malformed `logs` value rather than throwing: a log write
 * failing must never be what fails a generation the model already produced.
 *
 * @param existing - Current `logs` column value.
 * @param message - What the step did.
 * @param at - Timestamp for the entry.
 * @returns The new timeline, oldest first, capped at the most recent entries.
 */
export function appendLogEntry(
  existing: Json | null,
  message: string,
  at: Date = new Date(),
): MusicLogEntry[] {
  const entries = Array.isArray(existing) ? (existing as unknown as MusicLogEntry[]) : [];
  const appended = [...entries, { at: at.toISOString(), message }];

  return appended.slice(-MAX_LOG_ENTRIES);
}
