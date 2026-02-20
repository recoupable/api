import type { PresetConfig } from "./types";
import { parseJsonLike } from "./postProcessors";

/** Sync licensing brief — visual scenes, energy curve, placement suggestions. */
export const syncBriefMatchPreset: PresetConfig = {
  name: "sync_brief_match",
  label: "Sync Brief Match",
  description:
    "Sync licensing analysis — visual scene matches, energy curve, best sync moments, and placement suggestions.",
  prompt: `Analyze this track for sync licensing placement. Return ONLY a valid JSON object (use double quotes) with these fields: "visual_scenes" (array of 5 specific scenes this track would fit, e.g. "rainy window scene in a coming-of-age film"), "emotional_arc" (string describing how the emotion shifts across the track), "energy_curve" (string like "low-build-peak-fade" or "steady medium"), "best_sync_moments" (array of objects with "timestamp_range" like "0:00-0:30" and "description" of what's happening musically and why it works for sync), "genres_for_brief" (array of genre tags a music supervisor would search), "avoid_for" (array of contexts where this track would NOT work, e.g. "upbeat car commercial"). No other text.`,
  params: { max_new_tokens: 1024, temperature: 0.4, do_sample: true },
  requiresAudio: true,
  responseFormat: "json",
  parseResponse: (raw) => parseJsonLike(raw),
};
