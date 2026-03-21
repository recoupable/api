import { processAnalyzeMusicRequest } from "@/lib/flamingo/processAnalyzeMusicRequest";

export interface ArtistMusicAnalysis {
  catalog_metadata: unknown;
  audience_profile: unknown;
  playlist_pitch: unknown;
  mood_tags: unknown;
}

const ANALYSIS_PRESETS = [
  "catalog_metadata",
  "audience_profile",
  "playlist_pitch",
  "mood_tags",
] as const;

type AnalysisPreset = (typeof ANALYSIS_PRESETS)[number];

/**
 * Runs 4 MusicFlamingo presets in parallel on a Spotify 30-second preview URL.
 * Analyzes genre, BPM, key, mood, audience profile, playlist targets, and vibe tags.
 *
 * @param previewUrl - Spotify 30-second preview URL (public MP3).
 * @returns Parallel analysis results, or null if all presets fail.
 */
export async function getArtistMusicAnalysis(
  previewUrl: string,
): Promise<ArtistMusicAnalysis | null> {
  const results = await Promise.allSettled(
    ANALYSIS_PRESETS.map(preset =>
      processAnalyzeMusicRequest({
        preset,
        audio_url: previewUrl,
        max_new_tokens: 512,
        temperature: 1.0,
        top_p: 1.0,
        do_sample: false,
      }),
    ),
  );

  const analysis: Record<AnalysisPreset, unknown> = {
    catalog_metadata: null,
    audience_profile: null,
    playlist_pitch: null,
    mood_tags: null,
  };

  let anySuccess = false;
  results.forEach((result, i) => {
    const preset = ANALYSIS_PRESETS[i];
    if (result.status === "fulfilled" && result.value.type === "success") {
      const value = result.value as { type: "success"; response: unknown };
      analysis[preset] = value.response;
      anySuccess = true;
    }
  });

  return anySuccess ? (analysis as ArtistMusicAnalysis) : null;
}
