# Catalog track → Context ObjectRef qualification (#2207 / #2222)

Status: source/design qualification, October 27, 2026. **The current saved Luminate
catalog surface cannot emit a live Context ObjectRef.** Existing catalog expansion
provides a real recording-identity path, but the stream observations have no retained
Context source-version binding or Context withdrawal contract. Keep unsupported-source
refusal in place. This document adds no runtime adapter, schema, migration or grant.

## Evidence pins and ownership

Inspected already-local source, not a hosted database or customer catalog:

- API `4ed1fdb1c4d1da38c0e179530205102f64d252c3` (base of this PR).
- Database `001cd115a605f2f69901802999db8220bab0cc45`.
- App `f6092fd5f65ccc247b6bf3d1ec1af9b5f584712e`: `lib/intelligent-ui/descriptors/{contextObjectRef,schemas}.ts`.
- Proposal-only API #1185 `484cb541` (`docs/contracts/durable-surfaces-2207.md`)
  and Database #126 `6d1da438` (`proposals/durable-surfaces-2207/PROTOCOL.md`).
  Their source gate remains closed; neither proposal establishes runtime mapping.

These are exact source snapshots, not a claim that remote main remained unchanged.
No repository refresh, provider call, import, database read/apply or grant was performed.
Root owns ordering; Context owns shared authority/persistence; Catalog owns source
meaning and identity qualification; UI owns descriptor consumption. Existing issues:
[2207](https://github.com/recoupable/app/issues/2207) and
[2222](https://github.com/recoupable/app/issues/2222).

## Existing Catalog read: what its identifiers mean

`lib/catalog/getCatalogStreams.ts` validates completed UTC periods, resolves the actor's
personal/organization owner IDs, and checks `account_catalogs(account=workspaceId,
catalog=catalogId)` for the explicitly selected workspace. The bounded membership read
is `catalog_songs.catalog = catalogId` joined through `catalog_songs.song = songs.isrc`;
`selectCatalogRecordingPage` returns ISRC/name, including unmeasured recordings.

`read_catalog_stream_days` selects the latest row per date by `retrieved_at DESC,
run_id DESC`. Its evidence identity is the retained tuple
`(catalog_id,isrc,date,run_id,provider_recording_id,source_hash,retrieved_at,streams)`.
`run_id` identifies `catalog_stream_runs`, not a Context source version;
`provider_recording_id` is a provider identifier, not a Context subject. Source hashes
and the surface fingerprint are not UUID authority. `getCatalogStreams` keeps the
latest-per-date rows as lineage, chooses the latest provider identity, and includes
only matching-identity rows in the comparison. The read is not a transactional
cross-recording snapshot; the ownership check is not held through all read operations.

`lib/intelligent-ui/prepareCatalogSurface.ts` and its README preserve these facts as
`catalog-streams-v1`. This is Luminate all-DSP worldwide daily data, not Spotify annual
measurements, royalty income, ownership or catalog-wide totals. A Context metadata
source for the same recording cannot stand in for the stream observation's evidence.

## Existing authoritative recording joins

Database files below are pinned to the Database revision above. Paths are under
`supabase/migrations/`.

1. `20260920010000_context_foundation.sql`: `context_subjects.id` is the UUID;
   recording subjects have `kind='recording'` and unique `song_isrc → songs.isrc`.
   Subjects are global anchors, **not workspace authorization**. A bare ISRC equality
   can find an anchor but does not authorize its disclosure or its evidence.
2. `20260922070000_context_catalog_entry.sql`: an authorized catalog request binds
   `context_requests(owner_id,id,resource_id)` to a Recoup catalog resource and a
   catalog subject. Creation saves `catalog_identity` evidence; it does not create
   recording evidence or assert rights.
3. `20260923080000_context_execution_records.sql`:
   `context_request_catalog_members` retains `(request_id,owner_id,catalog_subject_id,
   recording_subject_id,catalog_id,song_isrc)`. Composite FKs bind the request/owner,
   catalog subject/catalog and recording subject/ISRC. `expand_context_catalog_members`
   is the existing **write** that creates missing recording subjects and these edges.
   Do not invoke expansion to repair a read or invent a missing edge in an adapter.
4. `list_context_catalog_member_targets` reads only expanded members joined to current
   `catalog_songs` and `account_catalogs`; its initial `list_context_catalog_members`
   call checks owner/request readiness, output catalog subject and exact Recoup resource.
   It returns the retained recording UUID and `identityConfirmed=true` for catalog
   ISRC identity. This is not provider-track verification or a rights finding.
5. `resolve_context_catalog_member_recording(owner,request,recording)` is the exact
   single-recording check: owner-matched partial/completed request; output contains
   the catalog subject; resource is `recoup/catalog` with provider ID equal to catalog
   UUID; both subject kinds and their catalog/ISRC agree; current workspace/catalog
   and catalog/ISRC membership exist. It returns the stored subject UUID and ISRC.
   API `lib/supabase/context_requests/listContextCatalogMemberTargets.ts` validates
   the target page and is consumed by `processContextOperation` planning. It does not
   return Context source versions or create a stream-to-evidence binding.

There is also a distinct Spotify request path: `commit_spotify_context` in
`20260920020000_context_spotify_pipeline.sql` rejects conflicting Spotify track→ISRC
mappings, creates/reuses the recording anchor and accepted resource identity link.
`list_context_request_targets` / `resolve_context_recording_isrc` require the accepted
identity link for that exact request resource. Do not use a Spotify link to reinterpret
a Luminate provider ID, or infer recording identity from a release slot/title.

## Exact source-version requirement remains separate

App `contextObjectRef` is only a projection of already-authorized input: owner must
match workspace; subject and 1–32 unique source-version IDs must be UUIDs; identity
must be confirmed; kind must be supported. It does no lookup or authorization.

The existing Context evidence chain is:
`context_documents(owner_id,subject_id,current_result_id,revision)` → accepted
`context_results(id,owner_id,subject_id,topic)` →
`context_result_sources(owner_id,result_id,source_version_id)` →
`context_source_versions(id,owner_id,source_id,removed_at)` →
`context_sources(id,owner_id,withdrawn_at)`.
All owner/subject/result relations must agree. Use exact versions associated with the
field's accepted current result; never select an arbitrary source for the recording.
Current document/result identity and version set must still match at save/reopen/
follow-up authorization. A new current result is not permission to silently replace
versions on an old selection.

`read_context_documents` in the Spotify pipeline migration selects current accepted
results for subjects in the owned request's `output.subjectIds` and excludes removed
versions/withdrawn sources. Expanded catalog recordings intentionally live outside
that output list; do not assume this reader returns their documents merely because
`context_request_catalog_members` contains them. No inspected Catalog stream reader
joins its observations to this evidence chain.

For a future durable implementation, require current actor→workspace membership,
workspace→catalog membership, catalog→recording membership and exact source authority
inside the accepted transaction/lock boundary. Existing `authorize_context_case_actor`
(`20261008160000_context_release_cases.sql`) locks organization membership FOR SHARE;
it does not by itself authorize a catalog or source. Database #126 specifies the
session/chat-before-source lock order and default refusal. The current Catalog GET's
separate checks do not satisfy that atomic durable boundary.

## Refusal and withdrawal contract

These are required consumer outcomes, not new public error codes or implemented APIs.
Private absent/inaccessible identities must share a redacted unavailable response.

| Evidence state | Required behavior |
| --- | --- |
| Authorized current expanded catalog member, no source-version binding | Recording identity is available for planning; no live ObjectRef for stream fields. |
| ISRC/name/provider ID/run hash only; subject or expansion edge missing | Refuse live mapping. No generated UUID, name match, implicit expansion or provider fetch. |
| Wrong workspace, revoked organization/catalog access, removed current membership | Withhold selection/content. Historical expansion edges do not restore authority. |
| Unsupported kind, including current Luminate stream source | Keep source gate denied. Explicit fixture authority remains synthetic only. |
| Conflicting provider identity or candidate/rejected identity link | Refuse promotion. Preserve source-owned conflict state; never select a convenient UUID. |
| Missing, removed, withdrawn, cross-owner or unrelated source version | Refuse ObjectRef/content; do not drop a failed version and claim complete lineage. |
| Current result/revision/version set changed, or read failed | Refuse stale/unknown binding; no silent latest substitution, empty-as-success or guessed ref. |
| More than 32 versions or unsupported selection bounds | Refuse; do not truncate lineage to fit the descriptor. |

`review_context_release_track_identities` in
`20260924110000_context_release_track_identity_review.sql` reports `conflict`,
`existing_identifier_match`, `unmapped` or `unresolved` from current source-backed
Spotify observations. `existing_identifier_match` is not itself a Context ObjectRef.
Candidate/conflict/rejected links are explicit in `context_resource_links`; no generic
Catalog quarantine lifecycle/table was found in the inspected migrations. Here
“quarantine” means withhold from live mapping pending owning reconciliation, not a
new persisted status or repair queue. Never invent a quarantine write.

Context `withdraw_context_source` (foundation migration) marks the owner's source
withdrawn, marks linked results withdrawn and clears their current document pointers
while advancing revisions. Reads also reject `context_source_versions.removed_at`.
This does not delete global recording identities or withdraw unrelated source kinds.

Catalog stream tracking disable fences future collection and retains observations;
it is **not withdrawal**. Removing `catalog_songs` membership removes the row from
current catalog reads but does not delete its stream history. The tracking→runs→
observations foreign keys cascade on parent deletion; a Context catalog subject's
restricting FK can block catalog deletion. These structural effects are not a
source-withdrawal policy or proof of removal from saved chat/export copies. The
inspected stream schema has no Context source/version FK or withdrawal flag. Existing
saved chat history is not a current-source authorization mechanism.

## Minimal dependency and ordering for root

Keep the development adapter's current source representation and live-selection
refusal. Existing identity joins above can be reused once the owning source contract
exists; adding a standalone UUID lookup now would be an unused and incomplete adapter.

Before enabling this particular live mapping, Catalog/Context must establish a
reviewed binding from the **exact retained stream observation tuple** to an owned,
accepted evidence result and its exact Context versions, plus an existing authorized
read path for expanded recording evidence. The binding must explain corrections,
provider-ID conflicts, missing versions and withdrawal/revocation for that source
kind. Neither `source_hash`, `run_id`, `catalog_identity` evidence nor an unrelated
Spotify metadata version supplies it. This is the precise missing dependency, not a
request to create a new identity table, ingestion service or retention policy here.

After that owner decision, qualify the bounded mapping with exact joins, source and
membership races, stale version rejection, cross-workspace redaction, missing/conflict
cases and withdrawal. Context integrates the authority check in its adopted durable
protocol; UI consumes only its authorized projection. Root orders those changes.
This PR qualifies source and required refusals only; no runtime tests or deployment
claims are substituted for the missing contract.

## Pinned source entry points

- [Catalog read and access](https://github.com/recoupable/api/blob/4ed1fdb1c4d1da38c0e179530205102f64d252c3/lib/catalog/getCatalogStreams.ts), [saved surface lineage contract](https://github.com/recoupable/api/blob/4ed1fdb1c4d1da38c0e179530205102f64d252c3/lib/intelligent-ui/README.md).
- [Context subject/source foundation and withdrawal](https://github.com/recoupable/database/blob/001cd115a605f2f69901802999db8220bab0cc45/supabase/migrations/20260920010000_context_foundation.sql).
- [Catalog request, expansion, retained member edges and resolvers](https://github.com/recoupable/database/blob/001cd115a605f2f69901802999db8220bab0cc45/supabase/migrations/20260923080000_context_execution_records.sql).
- [Spotify identity commit and current document reader](https://github.com/recoupable/database/blob/001cd115a605f2f69901802999db8220bab0cc45/supabase/migrations/20260920020000_context_spotify_pipeline.sql).
- [Stream storage and latest-day read](https://github.com/recoupable/database/blob/001cd115a605f2f69901802999db8220bab0cc45/supabase/migrations/20261009193000_catalog_daily_stream_tracking.sql), [current commit lock order](https://github.com/recoupable/database/blob/001cd115a605f2f69901802999db8220bab0cc45/supabase/migrations/20261010040000_catalog_stream_parent_lock_order.sql).
- [App Context projection](https://github.com/recoupable/app/blob/f6092fd5f65ccc247b6bf3d1ec1af9b5f584712e/lib/intelligent-ui/descriptors/contextObjectRef.ts), [ObjectRef validation](https://github.com/recoupable/app/blob/f6092fd5f65ccc247b6bf3d1ec1af9b5f584712e/lib/intelligent-ui/descriptors/schemas.ts).
