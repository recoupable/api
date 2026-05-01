import type { PresetConfig } from "./types";

/** A&R development notes — vocal, songwriting, production, next steps. */
export const artistDevelopmentNotesPreset: PresetConfig = {
  name: "artist_development_notes",
  label: "Artist Development Notes",
  description:
    "Senior A&R evaluation — vocal performance, songwriting, production, commercial potential, and next steps.",
  prompt: `You are a senior A&R representative at a major label evaluating this track. Write honest, constructive development notes covering:

1. VOCAL PERFORMANCE: Strengths and areas for growth. Tone, pitch, delivery, emotion.
2. SONGWRITING: Hook strength, lyric quality, structure, originality.
3. PRODUCTION: What's working, what could be elevated. Compare to current market standards.
4. COMMERCIAL POTENTIAL: Realistic assessment. What audience does this reach? How big?
5. NEXT STEPS: 3 specific, actionable recommendations for the artist.

Be direct but encouraging. This is internal A&R feedback, not a press release. Under 300 words.`,
  params: { max_new_tokens: 1024, temperature: 0.5, do_sample: true },
  requiresAudio: true,
  responseFormat: "text",
};
