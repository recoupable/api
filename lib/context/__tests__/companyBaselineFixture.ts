export const baseline = {
  contract_version: "company-baseline-v1",
  organization_id: "22222222-2222-4222-8222-222222222222",
  organization_name: "Example label",
  read_at: "2026-10-09T12:00:00+00:00",
  consistency: "live_read",
  coverage: "registered_roster_and_context_sources_only",
  artists: { items: [], next_id: null },
  professionals: { items: [], next_id: null },
  sources: { items: [], next_id: null },
  gaps: [
    "company_relationships_not_linked",
    "catalog_coverage_not_assessed",
    "sources_not_attributed_to_roster",
    "source_parsing_and_review_not_assessed",
    "rights_and_mandates_not_assessed",
  ],
};
