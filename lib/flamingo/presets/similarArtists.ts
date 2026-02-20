import type { PresetConfig } from "./types";
import { parseJsonLike } from "./postProcessors";

/** Similar artists with explanations. */
export const similarArtistsPreset: PresetConfig = {
  name: "similar_artists",
  label: "Similar Artists",
  description:
    "Suggests 5 similar artists based on sound, production, and vocal qualities, with reasoning.",
  prompt: `Based on the sound, production style, vocal qualities, and genre of this track, suggest 5 similar artists. Return ONLY a valid JSON object (use double quotes) with a field "similar_artists" containing an array of objects, each with: "name" (artist name), "similarity" (one sentence explaining why they are similar). No other text.`,
  params: { max_new_tokens: 512, temperature: 0.5, do_sample: true },
  requiresAudio: true,
  responseFormat: "json",
  parseResponse: (raw) => parseJsonLike(raw),
};
