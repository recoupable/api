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
const PRESETS: Record<string, PresetConfig> = {
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

/** Type representing a valid preset name. */
export type PresetName = (typeof PRESET_NAMES)[number];

/**
 * Looks up a preset config by name.
 *
 * @param name - The preset name (e.g. "catalog_metadata")
 * @returns The preset config, or undefined if not found or if name is "full_report"
 */
export function getPreset(name: string): PresetConfig | undefined {
  return PRESETS[name];
}

/**
 * Returns all individual presets as an array.
 * Excludes full_report (which is a composite, not a single preset).
 *
 * @returns Array of all preset configs
 */
export function getAllPresets(): PresetConfig[] {
  return Object.values(PRESETS);
}

/**
 * Returns a summary of all available presets for the /api/music/presets endpoint.
 *
 * @returns Array of preset summaries (name, label, description, requiresAudio, responseFormat)
 */
export function getPresetSummaries(): {
  name: string;
  label: string;
  description: string;
  requiresAudio: boolean;
  responseFormat: string;
}[] {
  const individual = Object.values(PRESETS).map((p) => ({
    name: p.name,
    label: p.label,
    description: p.description,
    requiresAudio: p.requiresAudio,
    responseFormat: p.responseFormat,
  }));

  return [
    ...individual,
    {
      name: FULL_REPORT_PRESET_NAME,
      label: "Full Report",
      description:
        "Runs all 13 presets in parallel and returns a comprehensive music intelligence report.",
      requiresAudio: true,
      responseFormat: "json",
    },
  ];
}
