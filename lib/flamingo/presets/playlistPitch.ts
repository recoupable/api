import type { PresetConfig } from "./types";

/** Spotify editorial playlist pitch — ready to send to curators. */
export const playlistPitchPreset: PresetConfig = {
  name: "playlist_pitch",
  label: "Playlist Pitch",
  description:
    "Spotify editorial playlist pitch — summary, rationale, suggested playlists, and comparable tracks.",
  prompt: `Write a Spotify editorial playlist pitch for this track. Follow this exact format:

SONG SUMMARY: One sentence describing the track.

WHY IT FITS: 2-3 sentences explaining why a playlist curator should add this. Mention the sound, mood, production quality, and what makes it stand out.

SUGGESTED PLAYLISTS: List 5 specific Spotify playlist names (real or realistic) this would fit on.

COMPARABLE TRACKS: Name 3 specific songs by other artists that live in the same sonic space.

Keep it professional, concise, and compelling. Under 200 words total.`,
  params: { max_new_tokens: 512, temperature: 0.6, do_sample: true },
  requiresAudio: true,
  responseFormat: "text",
};
