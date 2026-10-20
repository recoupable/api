import { contextCoverageSchema, type ContextCoverage } from "../schema";

export type SongEvidenceCoverageLabel =
  | "full"
  | "preview"
  | "unverified"
  | "wrong_recording"
  | "missing";

export interface SongEvidenceCoverageInput {
  /** Accepted `audio_source` content for the recording, or null when none is saved. */
  audioSource: {
    durationSeconds: number;
    verification?: { method?: string | null } | null;
  } | null;
  /** Length of a provider preview excerpt when that is the only audio available. */
  previewDurationSeconds?: number | null;
  /** Provider-reported recording duration, used only to detect a different recording. */
  expectedDurationSeconds?: number | null;
  /** Language attribution supplied by a lyrics document; trimmed and passed through, never guessed. */
  language?: string | null;
}

export interface SongEvidenceCoverage {
  label: SongEvidenceCoverageLabel;
  coverage: ContextCoverage;
  /** The flat coverage value `runContextEnrichment` persists. */
  persistedCoverage: "full" | "partial" | "unknown";
}

const DURATION_TOLERANCE_SECONDS = 2;
const MAX_LANGUAGE_LENGTH = 100;

/**
 * Classify what song evidence an analysis actually received. Full coverage requires waveform-verified
 * audio whose duration agrees with the recording; anything else stays a distinct preview, unverified,
 * wrong-recording or missing state so downstream consumers cannot mistake it for the complete song.
 * Never throws on caller input: a language label longer than a label can be is dropped, not truncated.
 *
 * @param input - Saved audio, optional preview length, optional provider duration and language label.
 * @returns A label, a schema-valid coverage record and the flat value to persist.
 */
export function resolveSongEvidenceCoverage(
  input: SongEvidenceCoverageInput,
): SongEvidenceCoverage {
  const trimmed = input.language?.trim();
  const language = trimmed && trimmed.length <= MAX_LANGUAGE_LENGTH ? trimmed : null;
  const expected = input.expectedDurationSeconds ?? null;
  const preview = input.previewDurationSeconds ?? null;
  const build = (
    label: SongEvidenceCoverageLabel,
    persistedCoverage: SongEvidenceCoverage["persistedCoverage"],
    coverage: Omit<ContextCoverage, "language">,
  ): SongEvidenceCoverage => ({
    label,
    persistedCoverage,
    coverage: contextCoverageSchema.parse({ ...coverage, language }),
  });
  const unavailable = (identity: "mismatch" | "uncertain" | "unknown") => ({
    extent: "unavailable" as const,
    identity,
    durationSeconds: expected,
    startSeconds: null,
    endSeconds: null,
  });
  if (input.audioSource) {
    const { durationSeconds, verification } = input.audioSource;
    const verified = verification?.method === "waveform-cross-correlation";
    const disagrees =
      expected !== null && Math.abs(durationSeconds - expected) > DURATION_TOLERANCE_SECONDS;
    if (disagrees) return build("wrong_recording", "unknown", unavailable("mismatch"));
    if (!verified) return build("unverified", "unknown", unavailable("uncertain"));
    return build("full", "full", {
      extent: "full",
      identity: "matched",
      durationSeconds,
      startSeconds: 0,
      endSeconds: durationSeconds,
    });
  }
  if (preview !== null && preview > 0) {
    if (expected !== null && preview > expected)
      return build("wrong_recording", "unknown", unavailable("mismatch"));
    return build("preview", "partial", {
      extent: "partial",
      identity: "uncertain",
      durationSeconds: expected,
      startSeconds: 0,
      endSeconds: preview,
    });
  }
  return build("missing", "unknown", unavailable("unknown"));
}
