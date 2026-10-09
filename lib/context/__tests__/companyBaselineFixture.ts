export const baseline = {
  contract_version: "company-baseline-v1",
  organization_id: "22222222-2222-4222-8222-222222222222",
  organization_name: "Example label",
  read_at: "2026-10-09T12:00:00+00:00",
  consistency: "live_read",
  coverage: "registered_roster_and_context_sources_only",
  artists: {
    items: [
      {
        relationship_id: "33333333-3333-4333-8333-333333333333",
        artist_id: "44444444-4444-4444-8444-444444444444",
        name: "Example artist",
      },
    ],
    next_id: null,
  },
  professionals: {
    items: [
      {
        professional_id: "55555555-5555-4555-8555-555555555555",
        name: "Example professional",
        roles: ["songwriter", "producer"],
        confirmation_basis: "operator_confirmed",
      },
    ],
    next_id: null,
  },
  sources: {
    items: [
      {
        source_id: "66666666-6666-4666-8666-666666666666",
        kind: "customer",
        created_at: "2026-10-09T12:00:00+00:00",
        retained_version_count: 1,
      },
    ],
    next_id: null,
  },
  gaps: [
    "company_relationships_not_linked",
    "catalog_coverage_not_assessed",
    "sources_not_attributed_to_roster",
    "source_parsing_and_review_not_assessed",
    "rights_and_mandates_not_assessed",
  ],
};
