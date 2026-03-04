import type { PresetConfig } from "./types";
import { parseJsonLike } from "./postProcessors";

/** Structured metadata for catalog enrichment — genre, BPM, key, mood, instruments. */
export const catalogMetadataPreset: PresetConfig = {
  name: "catalog_metadata",
  label: "Catalog Metadata",
  description:
    "Returns structured JSON metadata for catalog enrichment — genre, BPM, key, mood, instruments, similar artists.",
  prompt: `Analyze this track and return ONLY a valid JSON object (use double quotes). Fields: genre (string, primary genre), subgenres (array of up to 3), mood (array of up to 5 mood tags), tempo_bpm (integer), key (string like "C major"), time_signature (string like "4/4"), instruments (array), vocal_type (string or "none"), vocal_style (string), production_style (string), energy_level (1-10), danceability (1-10), lyrical_themes (array of up to 3), similar_artists (array of up to 3), description (one sentence). No other text.`,
  params: { max_new_tokens: 1024, temperature: 0.3, do_sample: true },
  requiresAudio: true,
  responseFormat: "json",
  parseResponse: (raw) => parseJsonLike(raw),
};
