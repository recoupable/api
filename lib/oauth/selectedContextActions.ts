/** Frozen consent capability v1. Do not derive this set from the evolving tool catalog. */
const actions = new Set<string>([
  "list_release_cases",
  "read_release_case",
  "read_release_case_review",
  "review_release_case",
  "save_brief",
  "read_brief",
  "plan",
  "list_executions",
  "list_catalog_members",
  "list_release_tracks",
  "read_release_track_observations",
  "review_release_track_identities",
  "verify_release_tracks",
  "expand_catalog_members",
  "plan_catalog_members",
  "read_execution",
  "ingest_catalog",
  "ingest_artist",
  "ingest_songwriter_name",
  "ingest_company_name",
  "ingest_campaign_brief",
  "ingest_supporting_text",
  "ingest_release",
  "verify_release",
  "ingest",
  "read",
  "brief",
]);

/** Expose membership without exposing runtime Set mutation methods. */
export const selectedContextActions = Object.freeze({
  has: (action: string) => actions.has(action),
});
