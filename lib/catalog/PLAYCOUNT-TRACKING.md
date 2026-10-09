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

## Audit: October 9, 2026

Current main `8c2e1e05` contains `song_measurements`, `playcount_snapshots`, catalog
measurement reads, album batching and Vercel Workflow capture/backfill helpers.
`vercel.json` declares 07:00 UTC daily maintenance. Its handler starts Songstats
backfill plus **monthly** snapshots after 30 days, copying the prior album list.
This does not give daily catalog coverage or automatically include new recordings.
The monthly path bypasses createSnapshot's estimated cost check. The initial job's
claim/re-read deduplication is not a transactional budget reservation. Mapping retries
can write again with a new capture timestamp; the measurement key is not a logical
provider-run/recording key. Whole-chunk failure can prevent remaining work. These
are existing gaps, not altered by this read slice.

Read-only GitHub deployment metadata: Production deployment `6965543959`, created
2026-10-09T16:18:32Z, reports success for main `8c2e1e0531d5cb70d25e7adc237fce73283c69db`.
That associates the declared cron with deployed source, but does not verify cron
registration/execution, retention, coverage or any actual live collection. No production
maintenance request was made: automatic approval review rejected that proposed check
because it might initiate work/spend. No paid provider run was made.

API PR #937 is gated **newsletter** enrollment, not catalog analytics scheduling;
its dirty checkout was preserved. Open #875 proposes Songstats removal, so new daily
tracking must not depend on its survival. Tracking issue: [#2177](https://github.com/recoupable/app/issues/2177). Existing #1796 concerns measurement/job
resource consolidation, #2073 concerns large snapshot materialization, #1899 concerns
non-comparable report cohorts, and Context #2144 owns scoped performance evidence.
Company baseline/evidence PRs remain independently owned and unapproved.

## Provider feasibility

There is no available Chartmetric API integration. Do not describe #2144's older
provider title as connected capability. Authorized Seeker evidence stays in its
private owning project; access here is not permission to ingest it.

- [Spotify Web API track reference](https://developer.spotify.com/documentation/web-api/reference/get-track)
  exposes metadata/popularity, not artist daily streams, listeners, saves or a cumulative
  stream-count field. Spotify OAuth does not create an analytics cron API.
- [Spotify for Artists exports](https://support.spotify.com/au/artists/article/exporting-data/)
  support downloaded CSV stats. [Update documentation](https://support.spotify.com/kh/artists/article/when-stats-update/)
  specifies UTC days and approximate daily publication at 21:00 UTC. Authorized exports
  are the supported fallback for precise source-reported analytics. Authorized native
  exports were verified on October 9; see the adapter section below. Browser access
  enables a local export, not an unattended server analytics API. Refreshing this source
  requires another export until a supported provider/distributor feed is connected.
- The existing [Beat Analytics actor](https://apify.com/beatanalytics/spotify-play-count-scraper)
  claims cumulative public counts and album batching. Its current listed price is
  $4/1,000 input URLs, versus $3/1,000 in the code's estimate. For A album URLs and
  30 daily captures, the listed variable component is 0.12 × A USD/month; this excludes
  uncertain plan/usage charges and retries. No balance, commercial license, price
  guarantee, source-update SLA or small-count coverage has been verified. Vendor
  accuracy claims are not proof that every low-count recording returns an exact integer.
- [Spotify User Guidelines](https://www.spotify.com/us/legal/user-guidelines/)
  prohibit scraping. Existing actor availability and a configured token do not establish
  permission for this recurring commercial use. Do not activate new scraper collection
  without verified lawful access and an authorized spend ceiling.
- [Songstats official API](https://developers.stats.company/songstats) and its
  [official collection](https://github.com/Songstats/songstats-api) offer REST track
  current/historical data. Existing adapters and local key presence do not verify
  entitlement, contract, coverage, retention/update lag, low-count precision, quotas
  or price. No calls or new subscription were authorized or performed.

**Conclusion:** daily cumulative observation tracking is technically supported by
existing foundations, but universal exact daily Spotify stream coverage is not
established. Public totals cannot supply listeners/saves or exact calendar-day
streams. Use verified authorized artist/distributor exports for source-reported
analytics; keep that private metric separate from public observed counter changes.
No low-count public scraper response or campaign uplift has been verified here.

## Proposed collection architecture — not implemented or activated

1. Persist organization + catalog + provider subscriptions with explicit consent,
   lawful source/access evidence, cadence, pause/revoke status, budget ceilings,
   source-specific retention and an immutable version. Catalog access is separate
   from rights. Removal stops future collection, not automatic erasure of history.
2. Use existing maintenance cron → dispatcher → Vercel Workflows. Atomically claim
   `(subscription version, UTC scheduled day)` in Supabase with bounded leases.
   An expired lease can retry without duplicate spend/writes. No new scheduler or
   Trigger.dev job. Default new subscriptions off until source/spend prerequisites pass.
3. At each due day, recheck subscription, organization/catalog access and current
   paginated membership. Deduplicate verified recording/provider counter identities;
   batch deduplicated album IDs. Include catalog additions on the next run. Preserve
   historical membership manifests. Missing mappings remain explicit gaps, not zero;
   never enroll discovered collaborators into a roster. Unresolved/relinked counter
   identities start separate series. Duplicate releases cannot silently multiply totals.
4. Reserve worst-case authorized provider cost transactionally per organization/month
   and run before each chunk, including retries. Enforce provider max-total-charge
   options and finite album/recording/concurrency caps. The current estimate/read-then-
   insert check is insufficient. A cap pauses work with recorded coverage; never
   override spend gates or authorize top-ups. Read-only reporting remains usable.
5. Persist provider observation identity, normalized metric, precision/count status
   (`exact`, `thresholded`, `unavailable`, `missing`), upstream source time if supplied,
   observed/retrieved times, mapping version, private source/run reference, subscription
   version and immutable run/chunk receipts. Uniqueness must key logical source
   observation/counter, not a fresh retry timestamp. Preserve zero and corrections;
   changed exports preserve versions and dependent review invalidation.
6. Fetch and write as separate memoized workflow steps. Apply bounded retry with
   provider Retry-After/backoff for transient failures; isolate chunk/recording
   failures so other authorized work continues. Recheck revocation before fetch,
   retry, write and read; record skipped/failed/unmapped/thresholded coverage.
7. Shared authenticated HTTP/MCP reads and the platform catalog screen expose
   run status, source freshness, measured/eligible membership, gaps and period
   coverage. Compare complete equal periods on a fixed common cohort; report
   additions/removals separately. Exact source daily streams sum UTC days; cumulative
   counter deltas retain observation spans. Zero baselines and negative corrections
   stay explicit. No unsupported causal attribution to marketing/website clicks.

Native export formats are now verified and parsed locally (see below). The next slice
is private versioned import/reads in coordination with Context evidence work.
After provider/access/cost approval, add inactive durable subscriptions/claim migration,
workflow receipts and catalog UI, then release only with separate migration/merge
approval and actual authenticated readback. This PR is a useful read slice, not completion
of daily organization-wide collection or a second live-customer deployment.

## Native analytics adapter — tested locally, not a hosted importer

`parseSpotifyAnalyticsTimeline` supports the verified song `date,streams` and audience
`date,listeners,monthly listeners,monthly active listeners,super listeners,streams,playlist adds,saves,followers`
timeline headers. It extracts daily streams only, hashes original UTF-8 content for
version identity, preserves zeros and gaps, and rejects unknown schemas, duplicate or
invalid dates, thresholded/negative/unsafe counts, malformed rows and oversized files.
It deliberately does not support arbitrary CSV dialects or the period-total song table.
The native exports can cover more dates than the visible selected chart range.

`compareSpotifyDailyStreams` sums two adjacent equal UTC periods, independently of
the cumulative-counter comparison. Missing, duplicate, invalid or unfinished days and
unsafe totals suppress growth. A zero baseline has no percentage. Completed calendar
dates do not prove provider freshness. Unique listeners/monthly audience are not summed.

CSV rows lack provider IDs, scope, retrieval time and upstream update time. Caller-owned
private manifests must retain verified artist/track identities, export scope, source URL,
retrieval time and source hash. Never infer track identity from titles or filenames. Each
changed export is a distinct version, not an overwrite of observations. Leading zeros
before a release do not establish historical availability or catalog membership.

The adapter and daily comparator were exercised against authorized private files locally;
those files, identities and figures are excluded from source and fixtures. They do not
write Supabase, offer an upload endpoint, authorize access or activate jobs. Next: integrate
authenticated, catalog-scoped, versioned private import/storage and readback with the
Context evidence work. Automatic collection additionally needs a supported source feed,
verified entitlement/cost and durable subscription/run storage. CSV is an interim source,
not the intended permanent manual-refresh product workflow.
