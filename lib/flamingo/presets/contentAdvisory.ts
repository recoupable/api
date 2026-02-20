import type { PresetConfig } from "./types";
import { parseJsonLike } from "./postProcessors";

/** Brand safety and content advisory analysis. */
export const contentAdvisoryPreset: PresetConfig = {
  name: "content_advisory",
  label: "Content Advisory",
  description:
    "Brand safety analysis — explicit content flags, thematic advisory, and radio-friendliness.",
  prompt: `Analyze this track for brand safety. Return ONLY a valid JSON object (double quotes). Profanity means ONLY swear words (fuck, shit, damn, bitch, ass, hell, etc). The word "love" is NOT profanity. Fields: explicit (boolean, true ONLY if actual swear words are present), profanity_found (array of unique swear words found, empty array if none), themes (object with booleans: violence, drugs_alcohol, sexual_content, self_harm, political, religious, profanity, emotional_pain), brand_safety_rating (string: safe/caution/not_recommended), brand_safety_notes (string, one sentence), radio_friendly (boolean), content_summary (one sentence describing lyrical content). No other text.`,
  params: { max_new_tokens: 256, temperature: 0.2, do_sample: true },
  requiresAudio: true,
  responseFormat: "json",
  parseResponse: (raw) => parseJsonLike(raw),
};
