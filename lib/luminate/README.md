# Daily catalog streams

Luminate powers source-reported worldwide daily aggregate streams across reporting DSPs. This is separate from Spotify-only native analytics and public cumulative playcount history. The integration resolves recordings by ISRC; it never guesses identity from song titles or artist names.

## Runtime configuration

Server-only variables: `LUMINATE_API_KEY`, `LUMINATE_USERNAME`, `LUMINATE_PASSWORD`. Rotate these values to change credentials; no application code or saved measurements need to change. Tokens are cached in server memory, shared across requests, bounded to 24 hours and refreshed once after a recording request returns 401. Secrets and upstream error bodies never enter tool output or stored run receipts.

Apply database migration `20261009193000_catalog_daily_stream_tracking.sql` before releasing this API. It creates private tracking state, durable run receipts, append-only observation versions and service-role-only claim/commit/read functions. Browser database roles have no direct access. REST and MCP recheck current catalog ownership and organization membership.

## Use

- `POST /api/catalogs/{catalogId}/stream-tracking` with `{"action":"enable"}` starts initial collection and enables daily refresh.
- `GET /api/catalogs/{catalogId}/stream-tracking` reads state, latest run and per-ISRC coverage.
- POST `{"action":"disable"}` pauses collection and fences in-flight writes while retaining history.
- POST `{"action":"refresh"}` requests today's collection if not already claimed.
- `GET /api/catalogs/{catalogId}/streams?since=YYYY-MM-DD&days=28&page=1&limit=25` reads saved daily values and adjacent equal-period growth. `since` starts the current period; both ends are exclusive. Page until `pagination.has_more` is false.
- Standard MCP: `manage_catalog_stream_tracking`, `get_catalog_streams`. Delegated OAuth remains hidden/denied pending catalog organization-grant policy support.

## Collection and interpretation

Vercel Cron calls `/api/internal/catalog-stream-maintenance` at 09:00 UTC, protected by `CRON_SECRET`. A durable cursor-paginated dispatcher starts enabled catalogs. Each catalog revision can claim one run per UTC day. Repeated enable/refresh cannot duplicate collection; disable/re-enable creates a new revision. A failed daily claim can run again the next day. Workflow infrastructure retries steps up to three times; Luminate 429/5xx use bounded backoff. One exhausted provider failure records a gap and continues remaining recordings. A write-fencing refusal cancels the run; storage failures fail it.

Every run freezes current catalog membership and requests 62 calendar dates, ending two dates before the run date to allow provider lag. Fresh membership/revision/access is checked before provider calls and retries; atomic commit checks it again. New recordings join the next run. MVP catalogs are limited to 250 recordings; larger catalogs fail before provider requests. An empty catalog completes with empty coverage.

Each response is validated for the requested ISRC, territory, source window, metric, dates and safe nonnegative integers. Explicit zeros stay zero. Omitted dates become null observations. Unavailable recordings and failures remain coverage gaps. Source hashes identify parsed JSON responses; retrieval time is recorded separately from unavailable upstream update time. The two-day lag is a collection policy, not proof that Luminate has finalized every date.

Provider fetch and persistence are separate memoized steps, so write retries reuse the fetched payload. Observation uniqueness is `(run_id,isrc,date)`; logical run uniqueness is `(catalog_id,revision,scheduled_day)`. New runs retain new dates and correction versions instead of overwriting history or copying unchanged days. Each recording's run receipt retains fresh retrieval time, source hash, identity and coverage even when values are unchanged; the returned recording `latest_attempt` exposes that receipt. Observation `retrieved_at` is the retrieval that introduced its retained version. Latest-version selection occurs in SQL before returning the bounded day window, avoiding PostgREST row-limit truncation as versions accumulate.

Growth requires complete equal periods for one provider recording identity. Missing dates, invalid values or identity changes suppress growth. Zero baselines have null percentage; corrections can produce negative growth. Reads expose latest attempt/coverage and retrieval timestamps. Summaries are per-page and current-membership only; these are not royalty statements or evidence of marketing causation. Retained history extends beyond the rolling re-fetch window, but the MVP does not backfill dates older than the first run's 62-day window.

## Release verification

Before activation: apply the migration, configure the three server-only variables and existing `CRON_SECRET`, release the API, enable an accessible catalog, wait for completion and authenticate a history read. Check observed/missing coverage, source identity and values against a bounded provider response. Confirm the scheduled run separately; a local build or successful provider probe does not prove live cron execution.
