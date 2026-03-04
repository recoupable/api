import type { PresetConfig } from "./types";

/** Detects potential samples, interpolations, or references. */
export const sampleDetectionPreset: PresetConfig = {
  name: "sample_detection",
  label: "Sample Detection",
  description:
    "Identifies potential samples, interpolations, or strong musical references to existing songs.",
  prompt: `Analyze this track for any musical elements that sound like they could be samples, interpolations, or strong references to existing songs. For each potential match, describe: 1) what element sounds familiar (melody, chord progression, beat pattern, vocal cadence), 2) what it reminds you of (specific song/artist if possible), 3) your confidence level (high/medium/low). If nothing sounds sampled, say so.`,
  params: { max_new_tokens: 512, temperature: 0.5, do_sample: true },
  requiresAudio: true,
  responseFormat: "text",
};
