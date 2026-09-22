# Enrichment dependency execution

`runContextEnrichmentPlan` coordinates server-built plans using `runContextEnrichment` for each attempt. It is an in-process coordinator, not a durable workflow host or public endpoint.

- Validate missing dependencies, duplicate keys, cycles and concurrency before any side effect.
- Authorize before preparing inputs; the existing runner also authorizes before calling providers and saving results.
- Execute ready modules in bounded batches (default three). A batch completes before the next batch starts. Providers must still enforce their own shared rate limits.
- Pass only direct dependency persistence receipts to `prepare`. A receipt is not evidence content. Preparation must load authorized evidence and include relevant source/version data in the module input so the existing fingerprint reflects it.
- Reuse is handled by existing claim RPCs; this coordinator does not retry failures or ambiguous attempts.
- Block descendants after failure while completing unrelated branches. Returned outcomes include timing, blocked dependencies and failure stage without copying potentially sensitive exception text.
- `saved` means persisted successfully, not complete coverage. Store missing data as an explicit source gap and preserve `partial`/`unknown` coverage.

Provider dispatch, rate-limit provisioning, authenticated entry planning, durable hosting and live end-to-end integration remain outstanding. Current tests use fixture authorization/persistence and one fixture MusicBrainz response; they do not prove deployed behavior.

## Database integration prerequisites (source audit, 2026-09-22)

The current pilot `claim_context_enrichment` accepts only `catalog_metadata`, `lyrics`, `song_summary`, `artwork_branding`, and `artist_research`. New provider topics must not be relabeled to bypass that list. `complete_context_enrichment` currently sets `evidence_kind='interpretation'` for every result. Registry observations and modeled valuation estimates need explicit evidence kinds supported by a reviewed migration before production persistence.

The claim also requires the subject to appear in a completed or partial metadata request. The current authenticated ingestion path only resolves Spotify tracks. Company, campaign, songwriter and standalone catalog inputs need their own validated identity/request path before their modules can use this persistence boundary.

These are integration requirements, not resolved by the fixture RPC tests. Next integration work must cover topic validation, evidence kinds, missing/ambiguous source results, ownership/access checks, and real database round-trip tests before enabling provider dispatch.

A candidate database migration `20260922060000_context_provider_evidence.sql` now adds the six provider topics and validates their evidence kinds. Local rollback-only SQL tests pass for save/reuse, invalid kinds, unknown topics, and legacy defaults. It has not been applied to production. Registry sources use the existing `provider_metadata` source kind.

## MusicBrainz collector

`collectContextMusicBrainz` connects the ISRC adapter to the authorized claim/complete runner. Its module includes observation evidence type and a server-supplied collection version in the reuse fingerprint. A reused result skips the provider and rate-limit permit. A 404 is saved as unknown-coverage evidence; candidates remain partial and identity unconfirmed. Source links retain request provenance; the exact returned payload is in the result trace (not a separately versioned response-source row).

Requires database PR74 before runtime use. A shared provider limiter and entry dispatch remain caller responsibilities. The collection version must come from collection policy, not a random retry token. Wrapper tests currently use fixture persistence; they do not establish a live end-to-end database round trip.
