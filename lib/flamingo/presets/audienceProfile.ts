import type { PresetConfig } from "./types";
import { parseJsonLike } from "./postProcessors";

/** Target audience profile — demographics, platforms, listening contexts. */
export const audienceProfilePreset: PresetConfig = {
  name: "audience_profile",
  label: "Audience Profile",
  description:
    "Target audience analysis — demographics, platforms, listening contexts, comparable fanbases, and marketing hook.",
  prompt: `Based on the sound, production, lyrics, and overall vibe of this track, describe the target audience. Return ONLY a valid JSON object (use double quotes) with: "age_range" (string like "18-25"), "gender_skew" (string: "neutral", "female-leaning", or "male-leaning"), "lifestyle_tags" (array of 5 lifestyle descriptors, e.g. "journal-keeper", "iced coffee drinker", "late-night driver"), "listening_contexts" (array of 5 situations where someone would play this, e.g. "alone in bed at 2am", "rainy day studying"), "platforms" (array of platforms where this audience lives, e.g. "TikTok", "Spotify", "Pinterest"), "playlist_types" (array of 5 playlist names/types this fits, e.g. "sad girl autumn", "indie chill", "bedroom pop essentials"), "comparable_fanbases" (array of 3 artists whose fans would like this), "marketing_hook" (one sentence that captures why this audience connects with this track). No other text.`,
  params: { max_new_tokens: 1024, temperature: 0.5, do_sample: true },
  requiresAudio: true,
  responseFormat: "json",
  parseResponse: (raw) => parseJsonLike(raw),
};
