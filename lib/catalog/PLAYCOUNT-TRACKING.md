# Current daily-stream MVP

The Luminate integration now implements opt-in daily collection, durable run receipts,
versioned daily history and shared authenticated REST/MCP controls. See
[the integration guide](../luminate/README.md) for current implementation, configuration,
semantics, limits and release checks. It stores worldwide aggregate streams separately
from this document's legacy public Spotify counter series. The historical audit below
describes the earlier read-only slice; it is not the current collection implementation.

---

# Catalog playcount tracking: first read slice

## Implemented, not released

`GET /api/catalogs/{catalogId}/playcount-history?since=2026-09-03&days=2&page=1&limit=25`
and standard authenticated MCP `get_catalog_playcount_history` share one domain read.
Identity comes from API-key/Privy authentication or standard MCP auth. Every call
rechecks current catalog ownership/organization membership. Identity overrides
are rejected. Delegated OAuth is excluded until its organization-grant audit.

`since` is the current observation-period boundary. `days` selects two adjacent
periods of equal length (1–31 days). The example compares September 1→3 and
September 3→5; it requires completed observation dates through September 5.
Dates identify the latest stored observation on that UTC day, not exact midnight
stream boundaries. The response retains actual capture times. All days, including
both endpoints, must be observed, with capture time drift no greater than one hour
from the first day. Missing/invalid counts, corrections or excessive timing drift
suppress all growth fields. Zero prior change yields a null percentage, not infinity.

Songs come from current `catalog_songs`, with no roster filter. Unmeasured songs
remain in the page. Iterate pages while `pagination.has_more`; summaries are
page-scoped, never catalog totals. Membership is refreshed per page; concurrent
catalog edits can change paging. This is a current-catalog retrospective, not proof
that these songs belonged to the catalog on historical dates. Distinct ISRCs stay
distinct. Duplicate releases of one ISRC appear once under existing catalog identity.

Only public `apify_spotify_playcount` / `platform_displayed_play_count` rows are
read. No Songstats/private analytics, provider calls, billing, migrations or cron
changes. At most 25 recordings, five concurrent store reads and 500 observations
per recording. Exact query counts detect server truncation; errors return failure,
never zero or empty history. Raw run references are withheld. Responses are no-store.

**Legacy limitations:** stored measurements identify ISRC, provider and capture
time, but not the specific Spotify track/counter identity or upstream update time.
`comparison_quality=legacy_recording_series_identity_unverified` makes computed
changes provisional. Timing/coverage comparability is not proof of counter identity.
Do not use these changes to establish exact daily streams, marketing uplift, verified
provider identity or royalties. Numeric storage also cannot distinguish thresholds,
unavailability and unmapped failures; absent observations retain an unknown reason.
Historical rights, source access and membership cannot be inferred from this read.

## Source audit and native adapter

See [the dated audit](./PLAYCOUNT-TRACKING-AUDIT.md) for provider feasibility, the historical proposal and native CSV adapter documentation.
