import type { PresetConfig } from "./types";
import { parseJsonLike } from "./postProcessors";

/** Mood and vibe tags for playlist curation and discovery. */
export const moodTagsPreset: PresetConfig = {
  name: "mood_tags",
  label: "Mood Tags",
  description:
    "Returns mood/vibe/energy tags for playlist curation and music discovery.",
  prompt: `Listen to this track and return ONLY a valid JSON object (use double quotes) with two fields: "tags" (array of 8-10 mood/vibe/energy tags that could be used for playlist curation and music discovery, e.g. "dreamy", "late-night", "heartbreak", "chill"), and "primary_mood" (single word that best captures the overall feeling). No other text.`,
  params: { max_new_tokens: 256, temperature: 0.3, do_sample: true },
  requiresAudio: true,
  responseFormat: "json",
  parseResponse: (raw) => parseJsonLike(raw),
};
