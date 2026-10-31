// Synthetic, source-only copyable examples. No account, provider or live workflow is exercised.
const request = "00000000-0000-4000-8000-000000000003";
const subject = "00000000-0000-4000-8000-000000000004";
const record = "00000000-0000-4000-8000-000000000005";
const examples = [
  {
    action: "save_catalog_case",
    case_id: record,
    expected_revision: 0,
    idempotency_key: "catalog-case-example",
    snapshot: {
      schema_version: 1,
      case_id: record,
      workspace_id: "00000000-0000-4000-8000-000000000002",
      revision: 0,
      scope: "One supplied composition; customer assertion",
      sources: {},
      assessments: {},
      findings: {},
      actions: {},
      attempts: {},
      outcomes: {},
    },
  },
  { action: "read_catalog_case", case_id: record, revision: 1 },
  { action: "list_catalog_cases", limit: 50 },
  {
    action: "ingest",
    url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
    topics: ["catalog_metadata"],
    idempotency_key: "context-song-example",
  },
  { action: "ingest_catalog", catalog_id: record, idempotency_key: "context-catalog-example" },
  { action: "ingest_artist", artist_id: record, idempotency_key: "context-creator-example" },
  {
    action: "ingest_songwriter_name",
    name: "Example songwriter",
    idempotency_key: "context-songwriter-example",
  },
  {
    action: "ingest_company_name",
    name: "Example company",
    idempotency_key: "context-company-example",
  },
  {
    action: "ingest_campaign_brief",
    brief: { name: "Example release campaign", goal: "Review saved release evidence" },
    idempotency_key: "context-campaign-example",
  },
  {
    action: "ingest_supporting_text",
    title: "Submitted example note",
    text: "Customer-supplied assertion, not verified facts.",
    idempotency_key: "context-material-example",
  },
  {
    action: "ingest_release",
    url: "https://open.spotify.com/album/4uLU6hMCjMI75M1A2tKUQC",
    idempotency_key: "context-release-example",
  },
  { action: "read", request_id: request },
  { action: "plan", request_id: request },
  { action: "list_executions", request_id: request },
  { action: "read_execution", execution_id: record },
  { action: "list_catalog_members", request_id: request, subject_id: subject, limit: 20 },
  { action: "expand_catalog_members", request_id: request, subject_id: subject, limit: 20 },
  { action: "list_release_tracks", request_id: request, subject_id: subject, limit: 20 },
  { action: "read_release_track_observations", request_id: request, subject_id: subject },
  { action: "review_release_track_identities", request_id: request, subject_id: subject },
  { action: "verify_release", request_id: request },
  { action: "verify_release_tracks", request_id: request, subject_id: subject },
  { action: "list_release_cases" },
  { action: "read_release_case", request_id: request },
  { action: "read_release_case_review", review_id: record },
  {
    action: "review_release_case",
    request_id: request,
    fingerprint: "a".repeat(64),
    decision: "reviewed",
    note: "Metadata review only; no rights or distribution approval.",
    idempotency_key: "metadata-review-example",
  },
  { action: "brief", request_id: request, purpose: "playlist_pitch" },
  {
    action: "save_brief",
    request_id: request,
    purpose: "playlist_pitch",
    idempotency_key: "saved-pitch-example",
  },
  { action: "read_brief", brief_id: record },
];

export const contextOperationExampleInputs = examples.map(example => ({
  ...example,
  organization_id: "00000000-0000-4000-8000-000000000002",
}));
