import { PRESET_NAMES } from "./presetRegistry";
import { getPreset } from "./getPreset";
import { getAllPresets } from "./getAllPresets";
import { getPresetSummaries } from "./getPresetSummaries";

/** Type representing a valid preset name. */
export type PresetName = (typeof PRESET_NAMES)[number];
export { PRESET_NAMES, getPreset, getAllPresets, getPresetSummaries };
