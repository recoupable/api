/**
 * Configuration for a Music Flamingo preset.
 * Each preset defines a curated prompt, generation parameters,
 * and an optional response parser.
 */
export interface PresetConfig {
  /** Unique preset identifier (snake_case, e.g. "mix_feedback") */
  name: string;
  /** Human-readable label */
  label: string;
  /** Short description of what this preset does */
  description: string;
  /** The curated prompt sent to the model */
  prompt: string;
  /** Generation parameters */
  params: {
    max_new_tokens: number;
    /**
     * Only used when `do_sample` is true. Greedy presets keep the neutral 1.0,
     * since any other value makes transformers log an ignored-flag notice.
     */
    temperature: number;
    /**
     * False (greedy) for presets whose answer is stored as data, so the same
     * song gets the same answer on every run; true only for prose.
     */
    do_sample: boolean;
  };
  /** Whether this preset requires an audio_url */
  requiresAudio: boolean;
  /** Expected response format */
  responseFormat: "json" | "text";
  /**
   * Optional post-processing function applied to the model's raw output.
   * Used to fix JSON formatting, condense repetitions, etc.
   *
   * @param raw - The raw model output string
   * @returns The cleaned/parsed output
   */
  parseResponse?: (raw: string) => unknown;
}

/**
 * Report section order for the full_report preset.
 * Defines the narrative order of sections in the combined report.
 */
export interface ReportSection {
  /** Preset name to run */
  preset: string;
  /** Key name in the combined report JSON */
  reportKey: string;
}
