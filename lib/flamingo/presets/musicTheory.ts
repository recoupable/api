import type { PresetConfig } from "./types";
import { parseJsonLike, extractOneCycle } from "./postProcessors";

/** Music theory analysis — key, chords, structure, harmony. */
export const musicTheoryPreset: PresetConfig = {
  name: "music_theory",
  label: "Music Theory",
  description:
    "Music theory analysis — key, chord progression, time signature, song structure, and harmonic features.",
  prompt: `Analyze this track from a music theory perspective. Return ONLY a valid JSON object (use double quotes) with: key (string), scale (string like "major" or "natural minor"), tempo_bpm (integer), time_signature (string), chord_progression (array of chord symbols for ONE cycle of the main repeating progression — do NOT repeat the cycle), song_sections (array of objects with "name" like "intro" and "bars" as integer count), duration_seconds (number), notable_harmonic_features (string). No other text.`,
  params: { max_new_tokens: 512, temperature: 0.3, do_sample: true },
  requiresAudio: true,
  responseFormat: "json",
  parseResponse: (raw) => {
    const parsed = parseJsonLike(raw) as Record<string, unknown>;
    // Extract one cycle from potentially repeated chord progression
    if (Array.isArray(parsed.chord_progression)) {
      parsed.chord_progression = extractOneCycle(
        parsed.chord_progression as string[],
      );
    }
    return parsed;
  },
};
