export const relationshipActor = "11111111-1111-4111-8111-111111111111";
export const relationshipOwner = "22222222-2222-4222-8222-222222222222";
export const companySubject = "44444444-4444-4444-8444-444444444444";
export const rosterArtist = "55555555-5555-4555-8555-555555555555";
export const relationshipGaps = [
  "operator_assertion_not_verified",
  "no_ownership_rights_or_mandate_implied",
  "no_access_granted",
] as const;
export const formerRosterRelationship = {
  id: "66666666-6666-4666-8666-666666666666",
  company_subject_id: companySubject,
  counterparty: { kind: "artist_account", artist_id: rosterArtist },
  relationship_kind: "frontline_roster",
  status: "former",
  started_on: "2018-03-01",
  ended_on: "2020-12-31",
  basis: "operator_assertion",
  note: "Left after second album",
  asserted_by: relationshipActor,
  supersedes_id: null,
  superseded_by: null,
  created_at: "2026-10-10T12:00:00+00:00",
};
export const workspaceDistributionRelationship = {
  ...formerRosterRelationship,
  id: "77777777-7777-4777-8777-777777777777",
  counterparty: { kind: "workspace" },
  relationship_kind: "distribution",
  status: "current",
  started_on: null,
  ended_on: null,
  note: "",
};
export const relationshipReceipt = {
  contract_version: "company-relationship-v1",
  relationship: formerRosterRelationship,
  replayed: false,
  gaps: [...relationshipGaps],
};
export const relationshipPage = {
  contract_version: "company-relationship-v1",
  company_subject_id: companySubject,
  state: "available",
  coverage: "operator_asserted_relationships_only",
  items: [formerRosterRelationship, workspaceDistributionRelationship],
  next_id: null,
  gaps: [...relationshipGaps],
};
export const recordInput = {
  action: "record_company_relationship",
  organization_id: relationshipOwner,
  company_subject_id: companySubject,
  counterparty: { kind: "artist_account", artist_id: rosterArtist },
  relationship_kind: "frontline_roster",
  status: "former",
  started_on: "2018-03-01",
  ended_on: "2020-12-31",
  note: "  Left after second album ",
  idempotency_key: "roster-former-v1",
};
export const recordParams = {
  p_actor: relationshipActor,
  p_owner: relationshipOwner,
  p_company_subject: companySubject,
  p_counterparty: { kind: "artist_account", artist_id: rosterArtist },
  p_kind: "frontline_roster",
  p_status: "former",
  p_started_on: "2018-03-01",
  p_ended_on: "2020-12-31",
  p_note: "Left after second album",
  p_key: "roster-former-v1",
  p_supersedes: null,
};
export const listInput = {
  action: "list_company_relationships",
  organization_id: relationshipOwner,
  company_subject_id: companySubject,
};
export const listParams = {
  p_actor: relationshipActor,
  p_owner: relationshipOwner,
  p_company_subject: companySubject,
  p_after: null,
};
