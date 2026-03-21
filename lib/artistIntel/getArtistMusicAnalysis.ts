import { processAnalyzeMusicRequest } from "@/lib/flamingo/processAnalyzeMusicRequest";

/** Structured catalog metadata from MusicFlamingo catalog_metadata preset. */
export interface CatalogMetadata {
  genre: string;
  subgenres: string[];
  mood: string[];
  tempo_bpm: number;
  key: string;
  time_signature: string;
  instruments: string[];
  vocal_type: string;
  vocal_style: string;
  production_style: string;
  energy_level: number;
  danceability: number;
  lyrical_themes: string[];
  similar_artists: string[];
  description: string;
}

/** Audience demographics from MusicFlamingo audience_profile preset. */
export interface AudienceProfile {
  age_range: string;
  gender_skew: string;
  lifestyle_tags: string[];
  listening_contexts: string[];
  platforms: string[];
  playlist_types: string[];
  comparable_fanbases: string[];
  marketing_hook: string;
}

/** Mood and vibe tags from MusicFlamingo mood_tags preset. */
export interface MoodTagsResult {
  tags: string[];
  primary_mood: string;
}

export interface ArtistMusicAnalysis {
  catalog_metadata: CatalogMetadata | null;
  audience_profile: AudienceProfile | null;
  /** Text output from the playlist_pitch preset. */
  playlist_pitch: string | null;
  mood_tags: MoodTagsResult | null;
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

  const analysis: ArtistMusicAnalysis = {
    catalog_metadata: null,
    audience_profile: null,
    playlist_pitch: null,
    mood_tags: null,
  };

  let anySuccess = false;
  results.forEach((result, i) => {
    const preset = ANALYSIS_PRESETS[i] as AnalysisPreset;
    if (result.status === "fulfilled" && result.value.type === "success") {
      const value = result.value as { type: "success"; response: unknown };
      if (preset === "catalog_metadata") {
        analysis.catalog_metadata = value.response as CatalogMetadata;
      } else if (preset === "audience_profile") {
        analysis.audience_profile = value.response as AudienceProfile;
      } else if (preset === "playlist_pitch") {
        analysis.playlist_pitch = value.response as string;
      } else if (preset === "mood_tags") {
        analysis.mood_tags = value.response as MoodTagsResult;
      }
      anySuccess = true;
    }
  });

  return anySuccess ? analysis : null;
}
