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
