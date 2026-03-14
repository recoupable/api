import type { PresetConfig } from "./types";
import { PRESETS } from "./presetRegistry";

/**
 * Looks up a preset config by name.
 *
 * @param name - The preset name (e.g. "catalog_metadata")
 * @returns The preset config, or undefined if not found or if name is "full_report"
 */
export function getPreset(name: string): PresetConfig | undefined {
  return PRESETS[name];
}
