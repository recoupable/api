# Unwired Sites evidence adapters

These helpers target **proposal-only Database PR136**, current commit
`afd214aa73dfd70b0f2b860fce90c12ceb23f28b` (`proposals/sites-publish-evidence-2094/`).
The original capture/read qualification used `4caac3cc8a15a47b348109b2fa4f571423d8beb0`.
Its successor adds the expected-artist publication fence without changing capture/read
contracts or golden vectors. The separate [unwired publication orchestration](./site-selected-publication.md)
now consumes the scoped reader; no route, workflow or UI invokes the new flow.
The coverage and publication-wrapper exclusions below describe the #1263
capture/read contribution specifically; the linked orchestration page owns the
subsequent publisher, artist fence and their qualification. The proposal remains draft;
this source does not deploy a migration, expose a PostgREST schema, grant execution,
activate retention, add storage or change the advisory working-preview behavior.

## Capture and assessment

`captureSavedSiteReview` accepts authenticated server account context, the actual
**returned final-save Site**, and a stable server execution operation key. It reloads
the site, uses `authorizeSiteWorkspace`, checks owner/site/revision and the complete
saved draft, and selects the final saved review. It never guesses `revision + 1`,
uses an earlier successful report, fabricates a receipt or retries with another key.
The SQL function owns the create-once ID and timestamp. Exact retries return that
original receipt; advanced revisions or different payloads/actors conflict. Returned
metadata and the original report are checked before reporting capture success.

The extracted serializer retains the old `hashSiteEvidence` implementation byte for
byte. Capture and identity share one candidate projection excluding only
`production.reviews` and `production.status`. The committed golden vectors originate
from the proposal's actual API fixture (API `9fb18d85`); tests compare canonical
strings and hashes, including Unicode keys and JavaScript number formatting.
PostgreSQL JSONB text is never substituted for those canonical strings.

The original review is retained, including failed reviews. Original execution
hashes are compared with the shared render-artifact builder when present; a pass
without execution evidence is rejected. Capture never rewrites execution hashes
to make a report pass. A stored report is not automatically a passing assessment.

`assessStoredSitePublishEvidence` independently reloads and authorizes the site,
resolves its draft or the existing signed/current-generation working-build reader,
then reads a record scoped by actor, owner, site and record ID. SQL returns an
assessment record, **not the candidate**. The existing `assessSitePublishEvidence`
predicate checks the actual resolved snapshot, report and rendered-artifact hashes.
A failed read/access check propagates; it cannot become an automatic override.
There is no override capture or publication RPC wrapper in this change.

## Limits before activation

These are source adapters, not proof of hosted database admission or end-to-end
publication. The proposed schema has no default runtime admission; missing schema,
permission or transport failures remain failures. Only helpers under
`lib/supabase/site_publish_evidence` call its proposed RPCs. Generated database types
and deployment configuration are unchanged.

The read is an assessment at a point in time, not a publication lock. A future
publisher must repeat all existing paid/account/context/artist checks and use the
separately reviewed atomic SQL publication fence. `authorizeSiteWorkspace` plus the
signed generation reader is not the full generation/publish authorization chain.
Artist transitions, selected-preview interaction and explicit override interaction
remain unresolved activation work. SQL ownership/membership fences cannot by
themselves complete these product access requirements. A future final-save caller
must supply the trusted final assembled report; no public request may supply this
object or actor. No human approval is inferred or newly required here.

## SQL contract seams and local test scope

The 26 proposal tests below remain **SQL-fixture evidence** on PG15/17. API tests use
mocked repository/RPC boundaries and the actual predicate; they do not prove SQL
locking, ACLs, deployment, browser execution or provider execution. Publication-only
seams intentionally have no API write adapter. The inherited prerequisite test is
separate from these 26 tests.

| Proposal test suffix | API boundary / verification |
| --- | --- |
| original_identity_time_and_payload_retry | Capture preserves the returned ID/time and stable key on retries; unexpected receipt fields rejected. |
| parallel_capture_returns_one_original_record | Each capture issues one RPC, with no local identity/store; actual concurrent uniqueness is SQL-only. |
| roles_owner_and_scoped_read | Existing workspace authorization precedes actor/owner/site/record-scoped read. |
| revocation_blocks_capture_retry_read_and_publish | Authorization errors stop capture/read; RPC 42501 propagates; publication absent. |
| execute_privilege_revocation | RPC 42501 propagates without fallback. |
| publication_uses_stored_candidate_without_advancing_revision | No publication RPC; assessment uses separately resolved current candidate. |
| conflicts_leave_publication_unchanged | 40001/23505 propagate once; no publish side effect. |
| concurrent_publications_have_one_pointer_winner | No publication wrapper; pointer/transaction concurrency remains SQL-only. |
| failed_or_malformed_reports_cannot_publish_even_direct_sql | Actual predicate rejects malformed/failed/blocked/viewports/opening/direction reports. |
| override_requires_explicit_intent_and_same_actor | Existing predicate tests explicit intent/current actor; no override capture. |
| digest_mismatch_and_original_report_are_not_rewritten | Capture rejects source/journey/runner drift; actual predicate rejects report/digest drift. |
| legacy_clear_unpublish_and_pointer_forgery | No pointer/legacy publication write in adapters; existing publish regressions unchanged. |
| delete_retention_and_immutable_guards | No delete/update/retention adapter; missing site/record fails closed. |
| broad_defaults_do_not_leak_table_column_or_helper_access | RPC tests assert only exact named entry points; actual grants remain SQL-only. |
| shadow_objects_do_not_redirect_definers | Explicit fixed schema/RPC names; actual SQL search-path isolation remains SQL-only. |
| actor_null_missing_site_and_advanced_revision_retry | No-auth/missing-site/stale-revision tests; no record lookup on stale draft. |
| parallel_different_payload_same_key_has_one_winner | Conflict errors propagate without rekey/retry; concurrency remains SQL-only. |
| legacy_same_bytes_artist_timestamp_and_insert_pointer_guards | No publication/pointer API; artist transition remains an explicit activation gap. |
| failed_write_is_atomic_and_other_sites_survive_retention | Unavailable/conflict RPC responses and transport errors propagate once; SQL atomicity/retention remains SQL-only. |
| membership_revocation_waits_for_authorized_transaction | Existing auth plus SQL actor arguments; held-lock behavior remains SQL-only. |
| actual_api_digest_vectors_survive_jsonb_storage | Exact original canonical vectors checked against shared extracted serializer/hash. |
| capture_binds_returned_final_save_revision_not_claim_revision | Capture sends returned revision verbatim and rejects current revision drift. |
| draft_write_waiting_after_publish_preserves_live_pointer | No draft/publication writes; waiting/locking remains SQL-only. |
| owner_transition_cannot_orphan_retained_evidence | Reloaded owner mismatch rejected; SQL owner guard remains SQL-only. |
| nonspace_whitespace_is_not_explicit_override_reason | Actual predicate rejects NBSP, EM SPACE and BOM-only reasons. |
| corrupt_record_kind_is_not_eligible_for_direct_publication | Actual predicate rejects unknown kind; no publication fallback. |
