import type { PresetConfig } from "./types";
import { PRESETS } from "./presetRegistry";

/**
 * Returns all individual presets as an array.
 * Excludes full_report (which is a composite, not a single preset).
 *
 * @returns Array of all preset configs
 */
export function getAllPresets(): PresetConfig[] {
  return Object.values(PRESETS);
}

