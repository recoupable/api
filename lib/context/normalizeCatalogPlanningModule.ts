/** Public request names map to existing stored planner/claim identities. */
export const catalogPlanningModuleMap = {
  recording_candidates: "musicbrainz",
  recording_work_candidates: "mlc_recording",
  platform_metadata: "songstats",
  musicbrainz: "musicbrainz",
  mlc_recording: "mlc_recording",
  songstats: "songstats",
} as const;

/** Normalize before planning keys are created; never rename saved module IDs. */
export function normalizeCatalogPlanningModule(module: keyof typeof catalogPlanningModuleMap) {
  return catalogPlanningModuleMap[module];
}
