import type { PresetConfig } from "./types";

/** One-paragraph marketing description for pitches and press. */
export const songDescriptionPreset: PresetConfig = {
  name: "song_description",
  label: "Song Description",
  description:
    "One-paragraph marketing description suitable for playlist pitches, press releases, or music blogs.",
  prompt: `Write a one-paragraph marketing description of this track suitable for a Spotify playlist pitch, press release, or music blog. Make it vivid and compelling. Mention the genre, mood, standout production elements, and who would enjoy it. Keep it under 100 words.`,
  params: { max_new_tokens: 256, temperature: 0.7, do_sample: true },
  requiresAudio: true,
  responseFormat: "text",
};
