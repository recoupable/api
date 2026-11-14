import type { SongMomentType } from "@/lib/songMoments/songMomentsBodySchema";

/** How dense a section's arrangement is; every value to one decimal. */
export interface SectionArrangement {
  /** The percussive share of the section's energy, 0–100 (harmonic/percussive split). */
  percussive_pct: number;
  onsets_per_s: number;
  /** Share of the section's spectral energy at or above 2 kHz, 0–100. */
  high_pct: number;
  /** Share of the section's spectral energy below 120 Hz, 0–100. */
  sub_pct: number;
  rms_db: number;
}

/** One named section, in seconds from the start. */
export interface MeasuredSection {
  label: string;
  start: number;
  end: number;
  /** Sections sharing a letter sound alike (A, B, A, C...). */
  group: string;
  /** Average loudness for the section, 0–100 relative to the song. */
  energy: number;
  /** Present when the extended measurement ran. */
  arrangement?: SectionArrangement;
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

/** One of the seven bands the report draws. */
export interface BandProfileEntry {
  band: "sub" | "low" | "low_mid" | "mid" | "high_mid" | "high" | "air";
  lo_hz: number;
  hi_hz: number;
  /** The band's share of the mix's energy; the seven shares sum to about 100. */
  share_pct: number;
  /** Side energy relative to the band's mid energy. */
  side_pct: number;
  /** Level against a typical pop energy split, 0–100 (50 = on the reference). */
  level_pct: number;
  status: "clear" | "heavy" | "light";
}

/** Six axes, each 0 (left label) to 1 (right label). Calibrated on two songs. */
export interface SongFingerprint {
  organic_electronic: number;
  sparse_dense: number;
  dark_bright: number;
  intimate_anthemic: number;
  smooth_textured: number;
  slow_fast: number;
}

/** The raw measurements the fingerprint is built from. */
export interface SongFingerprintInputs {
  flatness: number;
  contrast_db: number;
  zcr_std: number;
  perc_ratio: number;
  onsets_per_s: number;
}

/** A sudden drop in level: a "mute" is under two beats, a "breakdown" two or more. */
export interface SongDrop {
  type: "mute" | "breakdown";
  start: number;
  end: number;
  beats: number;
  depth_db: number;
  /** The start as m:ss. */
  mmss: string;
}

/** The most common four-bar diatonic chord cycle; always low confidence. */
export interface ChordLoop {
  dominant_loop: string;
  loop_share: number;
  distinct_chords: number;
  bars: number;
  confidence: "low";
}

/** A typed place to cut into ("in") or out of ("out") the song. */
export interface EditPoint {
  type: "in" | "out";
  time: number;
  name: string;
  note: string;
  /** The time as m:ss. */
  mmss: string;
}

/**
 * How the song ends, read from the energy curve. `ending` carries the same
 * answer as "fade" or "cold" (stop and stop_with_tail are both "cold").
 */
export type EndingDetail =
  | { type: "fade"; from: number; silent_from: number; mmss: string }
  | { type: "stop"; stop_at: number; silent_from: number; mmss: string }
  | { type: "stop_with_tail"; stop_at: number; tail_until: number; mmss: string };

/** The extended measurement: loudness, stereo, spectrum, fingerprint, key, drops and edit points. */
export interface ExtendedSongMeasurement {
  /** Integrated loudness; the same figure as `loudness_lufs`. */
  lufs: number | null;
  /** Null when the file could not be read for true peak. */
  true_peak_dbtp: number | null;
  sample_peak_dbfs: number | null;
  crest_factor_db: number | null;
  loudness_range_lu: number | null;
  /** True peak at or under -1 dBTP and -16 to -7 LUFS; null when true peak is unknown. */
  broadcast_ready: boolean | null;
  stereo: { lr_correlation: number | null; side_to_mid: number | null };
  spectral_centroid_hz: number | null;
  rolloff95_hz: number | null;
  band_profile: BandProfileEntry[];
  fingerprint: SongFingerprint;
  fingerprint_inputs: SongFingerprintInputs;
  key: { tonic: string; mode: "major" | "minor"; confidence: number | null };
  time_signature: "3/4" | "4/4";
  valence: number;
  arousal: number;
  mute_drops: SongDrop[];
  chord_loop: ChordLoop;
  edit_points: EditPoint[];
  /** How `tempo_bpm` was decided (the beat tracker alone, or reconciled to a hint). */
  tempo_note: string;
  ending_detail: EndingDetail;
  /** Plain-language notes on the arrangement: "sparse open", "band thins at m:ss", "drums drop out at m:ss". */
  arrangement_notes: string[];
}

/** What the song-moments Modal endpoint returns. */
export interface MeasuredSong extends Partial<ExtendedSongMeasurement> {
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

const isNumberOrNull = (v: unknown) => v === null || typeof v === "number";
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const ARRANGEMENT_FIELDS: (keyof SectionArrangement)[] = [
  "percussive_pct",
  "onsets_per_s",
  "high_pct",
  "sub_pct",
  "rms_db",
];
const ENDING_TYPES: EndingDetail["type"][] = ["fade", "stop", "stop_with_tail"];

/** All five arrangement numbers. */
const isArrangement = (v: unknown) =>
  isObject(v) && ARRANGEMENT_FIELDS.every(field => typeof v[field] === "number");

/** A section's arrangement is optional; when present it must be complete. */
const hasValidArrangement = (section: unknown) =>
  !isObject(section) || section.arrangement === undefined || isArrangement(section.arrangement);

/** Top-level shape of each extended field, checked only when the field is present. */
const EXTENDED_FIELD_CHECKS: Record<keyof ExtendedSongMeasurement, (v: unknown) => boolean> = {
  lufs: isNumberOrNull,
  true_peak_dbtp: isNumberOrNull,
  sample_peak_dbfs: isNumberOrNull,
  crest_factor_db: isNumberOrNull,
  loudness_range_lu: isNumberOrNull,
  broadcast_ready: v => v === null || typeof v === "boolean",
  stereo: isObject,
  spectral_centroid_hz: isNumberOrNull,
  rolloff95_hz: isNumberOrNull,
  band_profile: Array.isArray,
  fingerprint: isObject,
  fingerprint_inputs: isObject,
  key: isObject,
  time_signature: v => typeof v === "string",
  valence: v => typeof v === "number",
  arousal: v => typeof v === "number",
  mute_drops: Array.isArray,
  chord_loop: isObject,
  edit_points: Array.isArray,
  tempo_note: v => typeof v === "string",
  ending_detail: v => isObject(v) && ENDING_TYPES.includes(v.type as EndingDetail["type"]),
  arrangement_notes: v => Array.isArray(v) && v.every(note => typeof note === "string"),
};

/**
 * Type guard for the song-moments Modal response: checks the fields callers
 * rely on (sections, moments and the timing numbers), not every nested value.
 * Extended fields are optional; when present, each must have its top-level type,
 * and a section's `arrangement` must carry its five numbers.
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
    candidate.sections.every(hasValidArrangement) &&
    Array.isArray(candidate.moments) &&
    Array.isArray(candidate.energy_curve) &&
    Object.entries(EXTENDED_FIELD_CHECKS).every(
      ([field, check]) => candidate[field] === undefined || check(candidate[field]),
    )
  );
}
