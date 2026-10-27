# Retained stream evidence binding proposal (#2207)

Status: source/design proposal, October 27, 2026. Luminate live ObjectRef mapping remains denied. This document does not add an API action, database writer, provider call, migration or grant. Root owns adoption and Catalog owns source meaning review.

The preceding [Catalog identity qualification](catalog-context-identity-2207.md) identified the missing exact observation-to-Context evidence chain. The companion Database proposal is `proposals/stream-evidence-binding-2207/PROTOCOL.md`, based on Database `6ae03a0cc71dc2ad3955594c9cfcb6156c3fb8b8`. API source inspected here is `c1298deb6bb981543bf442d26a32def889e60d71`.

## Representation proposed for review

Use the existing Context source, immutable version, attempt, accepted observation result, result-source link and current document tables. No second observation store or inferred UUID. One version contains a bounded, date-ordered snapshot of the **exact** retained tuples:

`(catalog_id,isrc,date,run_id,provider_recording_id,source_hash,retrieved_at,streams)`.

Proposed source locator is `urn:recoup:luminate-daily:<catalog UUID>:<recording subject UUID>` within the owner. Topic is `luminate_daily_streams_v1:<catalog UUID>`; recipe `retained-luminate-daily-v1`; schema 1. Content includes schemaVersion, catalogId, subjectId, isrc, metric `luminate_all_dsp_worldwide_daily_streams`, inclusive since, exclusive until and observations. A single version can retain all 62 days without truncating lineage to satisfy ObjectRef's 32-version maximum. Preserve missing days and nullable streams; no zero filling or broader rights/revenue claim.

One document is current per owner/recording/catalog in this minimal proposal. Another accepted window supersedes it, so old selections become stale. If simultaneous windows must remain current, adopt a window-qualified topic before implementation. Catalog/root must review that choice alongside source withdrawal scope: withdrawal would affect every window/version for that owner/catalog/recording. No new retention policy or automatic restoration is authorized here.

## Why existing writers/readers are insufficient

- `save_context_metadata` hardcodes Spotify provider/recipe/coverage and uses an active-source lookup. It must not create Luminate evidence or recreate a withdrawn reserved source.
- `collectContextSongstats` / `runContextEnrichment` authorize and dispatch provider work. Retaining already-saved Catalog observations is a separate local transaction; routing it through provider collection would change the operation's meaning.
- `attach_evidence` associates an **existing exact version** with independently authorized targets. It cannot manufacture this missing version or confirm identity.
- `read_context_documents` checks `output.subjectIds`. Expanded recordings are intentionally outside that array. Reuse the exact expanded-member resolver under current actor/workspace/catalog/recording locks, then authorize the accepted result's exact source/version chain. Do not broaden the ordinary reader blindly.

## Future API boundary; not an implemented endpoint

Authentication derives actor/owner. Strict shared API/MCP validation must constrain request, recording subject, catalog, completed UTC window, expected document revision and expected observation tuple set. A descriptor cannot supply authoritative content, owner, provider identity or arbitrary source-version IDs. Measure outbound UTF-8 bytes as well as database payload limits before returning a descriptor.

The proposed Database read qualification accepts an exact request/subject/catalog, result/version and document revision. It returns ownerId, requestId, subjectId, catalogId, resultId, revision, topic, sourceVersionIds and evidence only after current authority and tuple readback. These are proposal field names, not a published API schema. Map only its authorized recording/version projection into ObjectRef; retain the exact result/topic/revision and observation binding alongside the field selection for subsequent durable validation. A bare ObjectRef is insufficient to reconstruct which stream field or current result was authorized.

Reject stale corrections, changed provider IDs, removed/withdrawn versions, missing edges, mixed identities and cross-workspace references. Private absent and inaccessible cases share a redacted unavailable response. SQL/transport failure remains unavailable or unknown, never a successful empty snapshot. No silent latest substitution, implicit expansion, provider fetch, generated identity or unrelated metadata fallback.

Before accepting persistence, hold the adopted durable session/chat/fence locks and then source authority in one transaction. The proposal's source/version-before-result/ document order agrees with existing withdrawal; its parent/tracking/member order agrees with supported Catalog collection. Tracking disable is not withdrawal. Arbitrary direct observation writers are not proven safe by this lock protocol and must be inventoried before runtime release.

## Evidence and next gate

The Database proposal's seventeen disposable PostgreSQL 15/17 tests exercise existing migrations with synthetic parent/evidence rows. They cover exact joins, expanded members, current membership revocation, stale corrections/provider changes, explicit corrected versions, missing/removed lineage, source withdrawal and concurrent lock waits. This is a read/lock proof; fixture inserts do not implement a production writer.

Still required: Catalog's independent semantic review, root adoption, executable trusted retention writer with concurrent first-create/CAS/retry/rollback tests, withdrawn-source resurrection refusal, provider-history conflict reconciliation, strict API envelopes/byte limits, participating-writer enforcement and durable chat composition. Root reviews those changes before any shared runtime integration.
