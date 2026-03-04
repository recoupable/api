import type { ReportSection } from "./types";

/**
 * Defines the narrative order of sections in the full music intelligence report.
 * Each section maps a preset name to a key in the combined report JSON.
 *
 * Order follows a natural reading flow:
 * What is it? → How does it feel? → What does it say? → Is it safe? →
 * How is it made? → Who sounds like this? → Any legal issues? →
 * Who's the audience? → Where can it be placed? → How do we pitch it? →
 * What's next for the artist?
 */
export const FULL_REPORT_SECTIONS: ReportSection[] = [
  { preset: "catalog_metadata", reportKey: "overview" },
  { preset: "mood_tags", reportKey: "mood" },
  { preset: "song_description", reportKey: "description" },
  { preset: "lyric_transcription", reportKey: "lyrics" },
  { preset: "content_advisory", reportKey: "content_advisory" },
  { preset: "music_theory", reportKey: "music_theory" },
  { preset: "mix_feedback", reportKey: "mix_feedback" },
  { preset: "similar_artists", reportKey: "similar_artists" },
  { preset: "sample_detection", reportKey: "sample_detection" },
  { preset: "audience_profile", reportKey: "audience" },
  { preset: "sync_brief_match", reportKey: "sync" },
  { preset: "playlist_pitch", reportKey: "playlist_pitch" },
  { preset: "artist_development_notes", reportKey: "development" },
];

/** The full_report preset name constant. */
export const FULL_REPORT_PRESET_NAME = "full_report";
