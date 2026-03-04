import type { PresetConfig } from "./types";
import { catalogMetadataPreset } from "./catalogMetadata";
import { moodTagsPreset } from "./moodTags";
import { lyricTranscriptionPreset } from "./lyricTranscription";
import { mixFeedbackPreset } from "./mixFeedback";
import { songDescriptionPreset } from "./songDescription";
import { musicTheoryPreset } from "./musicTheory";
import { similarArtistsPreset } from "./similarArtists";
import { sampleDetectionPreset } from "./sampleDetection";
import { syncBriefMatchPreset } from "./syncBriefMatch";
import { audienceProfilePreset } from "./audienceProfile";
import { contentAdvisoryPreset } from "./contentAdvisory";
import { playlistPitchPreset } from "./playlistPitch";
import { artistDevelopmentNotesPreset } from "./artistDevelopmentNotes";
import { FULL_REPORT_PRESET_NAME } from "./fullReport";

/** All individual preset configs indexed by name. */
export const PRESETS: Record<string, PresetConfig> = {
  [catalogMetadataPreset.name]: catalogMetadataPreset,
  [moodTagsPreset.name]: moodTagsPreset,
  [lyricTranscriptionPreset.name]: lyricTranscriptionPreset,
  [mixFeedbackPreset.name]: mixFeedbackPreset,
  [songDescriptionPreset.name]: songDescriptionPreset,
  [musicTheoryPreset.name]: musicTheoryPreset,
  [similarArtistsPreset.name]: similarArtistsPreset,
  [sampleDetectionPreset.name]: sampleDetectionPreset,
  [syncBriefMatchPreset.name]: syncBriefMatchPreset,
  [audienceProfilePreset.name]: audienceProfilePreset,
  [contentAdvisoryPreset.name]: contentAdvisoryPreset,
  [playlistPitchPreset.name]: playlistPitchPreset,
  [artistDevelopmentNotesPreset.name]: artistDevelopmentNotesPreset,
};

/**
 * All valid preset names (including full_report).
 * Used for Zod enum validation in the request schema.
 */
export const PRESET_NAMES = [
  ...Object.keys(PRESETS),
  FULL_REPORT_PRESET_NAME,
] as const;

