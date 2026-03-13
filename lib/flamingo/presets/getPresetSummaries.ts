import { FULL_REPORT_PRESET_NAME } from "./fullReport";
import { PRESETS } from "./presetRegistry";

interface PresetSummary {
  name: string;
  label: string;
  description: string;
  requiresAudio: boolean;
  responseFormat: string;
}

/**
 * Returns a summary of all available presets for the /api/songs/analyze/presets endpoint.
 *
 * @returns Array of preset summaries (name, label, description, requiresAudio, responseFormat)
 */
export function getPresetSummaries(): PresetSummary[] {
  const individual = Object.values(PRESETS).map(p => ({
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
