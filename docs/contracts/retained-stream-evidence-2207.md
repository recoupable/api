# Retained stream evidence binding proposal (#2207)

Status: source/design qualification, October 27, 2026. Luminate live ObjectRef mapping remains denied. No API action, retention writer, migration, grant or provider operation is introduced. This revision aligns to root's adopted [Catalog contract](https://github.com/recoupable/api/blob/08f62b7474e52b2bd0114d2d2c62c642c17ef6bf/docs/contracts/catalog-stream-evidence-2207/README.md) and [31 synthetic vectors](https://github.com/recoupable/api/blob/08f62b7474e52b2bd0114d2d2c62c642c17ef6bf/docs/contracts/catalog-stream-evidence-2207/vectors.json), API #1187 head `b185ea9ded070cd6d621d2bf13843bf9df6e5a8f`, merge `08f62b7474e52b2bd0114d2d2c62c642c17ef6bf`. Prior dynamic-topic/locator/62-date recommendations in this PR are superseded.

The companion [Database #127](https://github.com/recoupable/database/pull/127) protocol is `proposals/stream-evidence-binding-2207/PROTOCOL.md`, with an evidence read/lock proof and vector-port map. Root reviews revised exact heads and fresh CI; Catalog independently reviews source alignment. No runtime integration precedes that adoption.

## Adopted source representation

Reuse existing Context source, immutable version, attempt, accepted observation result, lineage and current document tables. Stable topic: **`catalog_retained_streams`**. Stable owned source locator: **`urn:recoup:retained-catalog-streams:<catalog UUID>:<recording UUID>:all_dsps:worldwide`**, kind `provider_metadata`. Provider recording ID belongs only in version content. The locator is not a supported provider fetch/ingest URL.

Existing document uniqueness means **one current document per owner/recording/topic across catalogs and windows**. New catalog/window acceptance uses revision CAS and makes older bindings stale. Do not manufacture dynamic topics or promise simultaneous-current windows. Withdrawal covers every version/result of the selected owned series; historical withdrawal must also block recreation under a fresh active source UUID.

One exact version retains up to **732 dates**, matching two complete equal UTC periods of 1–366 days in current Catalog GET. Provider collection runs remain bounded to 62 dates, so a bundle may span many runs. All latest-per-date tuples must remain present, including null rows:

`(catalog_id,isrc,date,run_id,provider_recording_id,source_hash,retrieved_at,streams)`.

Content includes schemaVersion, workspaceId, catalogId, subjectId, ISRC, provider `luminate`, metric `daily_streams`, platform `all_dsps`, territory `worldwide`, timezone `UTC`, exact previous/current periods, selected providerRecordingId, sorted observations, distinct absentDates/nullDates and retained retrievalRange. Version `retrieved_at` is the **maximum included retained retrieval**; binding time belongs in attempt/result provenance. Published/source-updated time remains unknown. Never imply a new provider observation or freshness.

Require exact current catalog/run/ISRC linkage and each row's date within its run's inclusive range. Reject non-64-hex hashes, blank provider IDs, invalid/nonfinite timestamps, wrong scope, extra content, mixed IDs and changes from a previously accepted series identity without an owning disposition. Keep zero, null and absent distinct; no convenient provider subset, fabricated row or partial numeric sum. A bundle uses one exact version UUID, not a hash-derived UUID or one version per day.

## Byte limits and evidence-only qualification

The Database proof limits bundle content to **524,288 bytes (512 KiB)** and its full evidence response to **786,432 bytes (768 KiB)**, checking both UTF-8 PostgreSQL JSONB text and JSONB storage size. Reject oversize evidence; never truncate dates, strings or lineage. The 732-date synthetic case fits, but long retained identifiers may make a smaller case overflow.

A future API must also measure the actual serialized outbound UTF-8 bytes. These evidence limits do not raise durable command or source-part limits: a descriptor receives a bounded field projection and exact references, not the entire evidence bundle copied into saved controls or a chat data part. Content hashing remains Context's internal UTC JSONB-text SHA256, distinct from provider payload and JavaScript surface hashes.

The current SQL proof checks `normalized_response = version.content` and reconstructs the exact retained **evidence bundle only**. It does not validate or authorize derived complete-period sums, growth, safe-total overflow or a requested descriptor field. Those require the strict retention writer/result-field validator with existing `compareSpotifyDailyStreams` semantics. Its historical function name does not make this Spotify-only evidence. No live comparison-field ObjectRef is authorized by these tests.

## Existing gaps and future boundary

`save_context_metadata`, including the current guests replacement, hardcodes Spotify provenance and can look up only active sources; it must not bind this source or bypass withdrawal. `collectContextSongstats`/`runContextEnrichment` perform provider collection. `attach_evidence` requires an already-existing exact version and cannot create the missing binding. Current topic/ingest/coverage schemas and enrichment allowlists do not admit this retained stream source. Do not disguise it as Spotify metadata or invent audio-duration coverage.

Expanded recordings deliberately sit outside `request.output.subjectIds`. Use the existing exact expanded-member resolver under current actor/workspace/catalog/member locks, then the exact source/version/result/document chain. Never expand or create an identity to repair a read. Authentication derives actor/owner; descriptor payloads supply neither authority nor trusted source content.

The proposed evidence reader takes the exact request/subject/catalog/result/version/revision and returns ownerId, requestId, subjectId, catalogId, resultId, revision, stable topic, sourceVersionIds and evidence only after revalidation. These are proposal fields, not a published endpoint. A future field validator must retain the exact result/topic/revision and observation binding beside the selection; a bare ObjectRef cannot reconstruct field authority.

Durable calls hold adopted session/chat/fence locks before the source boundary. The proof requires READ COMMITTED, locks parent/tracking/member and source/version/result/document participants, and rechecks lineage in a fresh statement after waiting for the result lock. Existing rows are locked against mutation. Source withdrawal/revocation make later reads unavailable; tracking disable does not withdraw retained evidence. Private absent/inaccessible cases share redacted refusal. Operational SQL errors remain errors rather than successful empty snapshots.

Arbitrary direct inserts bypassing tracking remain outside the participating-writer proof. The date cap bounds output, not correction-history scans/locks. Runtime work still needs writer enforcement, a bounded row/work policy, retention CAS/retry/rollback, strict API transport validation, derived-field validation and durable composition. The SQL fixture does not implement or prove the production writer.

The revised Database suite has 25 disposable PostgreSQL tests, including 12-run/732-date evidence, cross-catalog/window replacement, correction/provider conflicts, null/missing/zero, malformed run/hash/time/scope, withdrawal resurrection refusal and byte overflow. Catalog's 31 vectors are mapped explicitly to covered evidence behavior versus unimplemented intake/comparison behavior. Root adoption of the source contract does not waive review of these amended protocol heads.
