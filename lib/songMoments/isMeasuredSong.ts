import type { SongMomentType } from "@/lib/songMoments/songMomentsBodySchema";

/** One named section, in seconds from the start. */
export interface MeasuredSection {
  label: string;
  start: number;
  end: number;
  /** Sections sharing a letter sound alike (A, B, A, C...). */
  group: string;
  /** Average loudness for the section, 0–100 relative to the song. */
  energy: number;
}

/** One moment, with edit points for each standard length that fits. */
export interface MeasuredMoment {
  type: SongMomentType;
  start: number;
  end: number;
  section: string;
  energy: number;
  /** Seconds keyed by length ("6", "15", "30"), each [start, end] on the beat grid. */
  cuts: Record<string, [number, number]>;
  /** Other moment types this one also covers, when they overlapped. */
  also?: SongMomentType[];
}

/** What the song-moments Modal endpoint returns. */
export interface MeasuredSong {
  /** Which version of the measurement produced this, so stored results can be rerun. */
  measured_with: string;
  duration_seconds: number;
  tempo_bpm: number;
  loudness_lufs: number | null;
  ending: "fade" | "cold";
  names_from: "lyrics" | "audio";
  sections: MeasuredSection[];
  moments: MeasuredMoment[];
  energy_curve: number[];
  elapsed_seconds: number;
}

/**
 * Type guard for the song-moments Modal response: checks the fields callers
 * rely on (sections, moments and the timing numbers), not every nested value.
 *
 * @param value - Unknown parsed JSON payload
 * @returns True when payload has the measured song shape
 */
export function isMeasuredSong(value: unknown): value is MeasuredSong {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.duration_seconds === "number" &&
    typeof candidate.elapsed_seconds === "number" &&
    Array.isArray(candidate.sections) &&
    Array.isArray(candidate.moments) &&
    Array.isArray(candidate.energy_curve)
  );
}
