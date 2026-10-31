# Current material receipts and the draft-origin dependency

`read` now connects an existing supporting-text request to its current retained
evidence version without a new schema or store. The additive `material_evidence`
receipt includes `request_id`, `material_subject_id`, `document_id`,
`document_version`, `result_id`, `source_version_ids`, and
`evidence_kind: "customer_assertion"`. An available receipt explicitly says
`draft_origin: { state: "not_recorded" }`. It is current evidence metadata, not
a historical export, private-file capability or reviewed business assertion.

This expansion is for HTTP and standard MCP. Delegated OAuth keeps the existing
request-only read until the organization-grant audit; the server derives that
transport policy from authenticated context, never a caller flag.

The shared HTTP/MCP operation reuses `list_context_material_request_target` and
`read_context_documents`. It validates the selected owner/request/material
subject, current assertion, submission fingerprint and matching source references,
then rechecks workspace access. Empty current documents and ineligible request
states return only `{ state: "unavailable" }` for this receipt. Invalid scope or
lookup failures expose no receipt. Checks are point-in-time reads, not a delivery
lock. Submitted text and source locations are never included in the receipt.

Existing pending Database #92/API #985 own paginated retained-evidence history;
this adds no competing history endpoint. Database #90/API #983 own typed
associations. Once their separately approved releases are available, pass the
receipt's exact source-version UUID into that operation. No association happens
automatically and material does not become artist/release/company metadata.

## Why verified origin is not captured by this no-migration slice

The existing `create_context_supporting_text_request` RPC accepts only
`p_owner`, `p_actor`, `p_title`, `p_text`, and `p_key`. It creates the immutable
source/version/result in one transaction. No argument writes a typed trusted
origin. Embedding a JSON origin or a special title inside `p_text` would be
forgeable through ordinary manual-text submission. Updating the version afterward
would split atomicity and invalidate its fingerprint/replay identity. Neither is
used here; `draft_origin` remains rejected as a public input.

## Exact minimal persistence dependency

A forward-only database change must add a service-only origin-aware text writer,
while retaining the existing five-argument manual-text RPC and its exact replay:

- Reuse the same request/source/version/result/document tables. Add no table,
  ledger, object upload or snapshot store. A validated origin object can live in
  the existing immutable source-version JSON content or `media_manifest`.
- The typed origin needs the registered workspace repository owner/name, relative
  path, observed ref, Git blob SHA and UTF-8 text SHA-256. Server verification time
  is receipt metadata; the authenticated submitting actor remains distinct from
  any file-author claim. Keep source-version UUID, document revision and both
  hash types separate.
- The API must derive workspace/repository/actor, check current access, and read
  the exact bounded text/SHA with the existing versioned Git reader before a first
  write. A caller cannot choose the repository or declare itself verified.
  Unversioned buffers and submodule origins lacking a scoped pinned contract remain
  unsupported as verified origins.
- Validate the normalized origin shape and text digest in the transaction; bind
  origin plus selected text/title into the request's existing idempotency identity.
  Preserve original submitter/version on exact replay and reject changed input.
- Add an owner-scoped, service-only lookup of the saved material receipt by the
  existing owner/key (or equivalent atomic reuse of that request). It must allow
  a lost-ack retry to recover before consulting mutable Git `main`, including
  when that file has advanced. Recheck current scope/withdrawal before returning
  protected origin metadata. No new replay ledger is needed.

Only after that contract is reviewed can a bounded API origin-capture path claim
verified repository/path/blob provenance. This PR adds no migration, trust secret,
origin parser over submitted text, hosted write or intake activation.
