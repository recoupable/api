# Retained Catalog stream evidence: minimum semantics for Context

**Recommendation for root/Context review, not an adopted or executable intake.**
October 27, 2026. Supports existing #2207/#2222 and the preceding
[identity qualification](../catalog-context-identity-2207.md). Live Catalog stream
ObjectRefs remain refused. Context owns the SQL/API proposal and implementation;
this handoff changes no runtime, schemas, migrations, grants, providers or retention.

Pinned available source: API `c1298deb6bb981543bf442d26a32def889e60d71`, Database
`6ae03a0cc71dc2ad3955594c9cfcb6156c3fb8b8`, App descriptor
`f6092fd5f65ccc247b6bf3d1ec1af9b5f584712e`. The merged API1185/Database126 protocols
remain source/design proposals. No refresh/fetch or hosted read was used.
`vectors.json` contains invented UUIDs, observations and authority states. Its
conditional expected refs illustrate this recommendation only; current code must
refuse every live promotion represented there.

## What the retained rows actually establish

- `lib/luminate/normalizeLuminateStreams.ts` validates uppercase ISRC request shape,
  an inclusive range of at most 62 days, response ISRC membership, `location=AA`,
  exact response dates, one Streams/total series, unique in-range dates and safe
  nonnegative integer values. Provider ID is a nonempty string, never a UUID claim.
  It hashes `JSON.stringify(payload)`; this hash alone cannot reconstruct or prove
  the raw response. The retained table does not store that raw payload.
- `fetchLuminateStreams.ts` bounds the response to 1,000,000 bytes and supplies a
  retrieval timestamp after normalization. Binding retained rows must not fetch
  again, claim raw re-verification or claim a new provider observation time.
- `20261010040000_catalog_stream_parent_lock_order.sql` is the current commit body.
  It locks owner/catalog/song parents, tracking, owner/catalog and catalog/song
  membership; checks enabled tracking, run revision and queued/running status;
  inserts complete/partial results for each day in the run range. Omitted provider
  dates become stored nulls. An equal latest value **and provider ID**, including
  null equality, suppresses a new row even if run/hash/retrieval changes. Failed
  attempts update coverage without new measurement rows. Existing PK
  `(run_id,isrc,date)` uses `ON CONFLICT DO NOTHING`, not overwrite.
- `20261009193000_catalog_daily_stream_tracking.sql` constrains safe nonnegative
  counts or null, required provider/hash/retrieval fields and FK lineage. Its SQL
  commit accepts trusted service JSON; it does not itself validate the upstream
  hash format, provider scope or response structure. A binder must check retained
  row identity against catalog/run and run range, not trust a caller's tuple.
- `read_catalog_stream_days` chooses latest per date by retrieval timestamp then
  run UUID descending, including null corrections. API reads at most 732 dates in
  nonoverlapping chunks of at most 62. The selected rows can span many runs.
  A run's final partial/failed/cancelled state does not erase an earlier committed
  row. Run coverage is not a replacement for row provenance.

## Recommended representation in existing Context tables

Choose **one source per workspace/catalog/recording/metric scope**, with versioned
bounded bundles of exact retained daily rows. Do not create one source/version per
run or day: a supported 732-day comparison can exceed the descriptor's 32-version
bound, and one run can contain observations for unrelated recordings.

Proposed logical source key: owner plus
`urn:recoup:retained-catalog-streams:<catalog UUID>:<recording UUID>:all_dsps:worldwide`.
This is an internal locator for retained data, not an observed provider URL or a
fetch target. Existing `context_sources.source_url` is text and its active unique
index is `(owner_id,kind,source_url)`; recommend `kind=provider_metadata`. Provider
ID belongs in the version contents, not the stable key, so withdrawal covers the
series across corrections/identity changes. This exact key remains a proposal.

Recommend topic `catalog_retained_streams`, explicitly **new to the intake allowlist**,
with `evidence_kind=observation`. An accepted result means a validated projection
of retained provider observations, not independently verified provider truth,
rights, money or freshness. The tables already allow text topics; this does not
mean current RPCs/API schemas accept the topic.

Each source version's content must include the schema/mapping version, workspace,
catalog, resolved recording UUID and ISRC, metric/platform/territory/timezone,
exact requested half-open comparison periods, selected provider identity, sorted
latest-per-date tuples `(catalog_id,isrc,date,run_id,provider_recording_id,streams,
source_hash,retrieved_at)`, absent dates, null dates and retained retrieval range.
The proposed strict validator must reject extra/ambiguous fields, malformed UUIDs,
non-date/out-of-window or duplicate dates, unsafe/negative/non-integer counts,
empty provider IDs, non-64-hex source hashes and invalid retrieval timestamps.
Resolve every tuple from storage and require run.catalog_id = tuple.catalog_id,
tuple date within that run range, exact catalog/ISRC and current recording binding.
SQL foreign keys alone do not enforce all of these equalities.
A stored null row and an absent row remain distinguishable. At least one retained
row is required to bind this source. No synthetic tuple is inserted for an absence.
Do not place current tracking-enabled state, display labels or the binding clock
in the version fingerprint; those are not observation identity. Validate them
separately where required. Preserve published/source-updated time as unknown.

The Context version fingerprint must be calculated by Context over the complete
normalized bundle using its declared serialization, not supplied by the caller.
Existing helpers use SHA-256 of PostgreSQL JSONB text. This is different from both
Luminate's payload hash and `catalog-streams-v1`'s JavaScript surface hash. Keep all
three labeled; do not claim cross-runtime byte equality. `source_version_id` is the
returned stored UUID. Its `retrieved_at` should represent the latest included
retained retrieval, with the entire range in content; binding time belongs in the
result/attempt provenance. Do not default retained observation time to now.

Result `normalized_response` should bind the exact declared fields to that bundle:
source-reported daily values; existing complete-period sums/growth; explicit
comparison state/missingness; periods, scope and retrieval provenance. Reuse
`compareSpotifyDailyStreams` semantics; its historical name does not make these
Spotify-only observations. Known zero is retained. If any required date is null or
absent, both sums/growth remain unknown; no partial sum. Safe-total overflow refuses
the numeric comparison. Known zero baseline leaves percentage growth null. Do not
attach finance assumptions, catalog totals, lyrics or metadata from other sources.
A field-bearing descriptor may use the one bundle UUID only when this exact field,
result/document revision and full source-version set agree.

Incomplete evidence may be accepted as an observation with `coverage.extent=partial`
and explicit unknown comparison fields; the ObjectRef identifies the evidence,
not a promise of complete numeric values. A completely absent series has no such
ref. `full` may mean all requested dates for this one recording and scope only,
never all DSP reporting, catalog completeness or fresh provider data.

Existing document uniqueness is `(owner_id,subject_id,topic)`. Under this minimal
proposal, another catalog or window for the same recording/topic replaces the
current result via CAS and makes earlier bindings stale. It must not overwrite
old versions, silently substitute new periods or dynamically create topics per
query. This deliberate limitation needs root acceptance before adoption. If
simultaneously current independent windows are required, return that requirement
to Context rather than expanding storage here.

## Existing primitives and intake gaps

| Existing source | Constraint / consequence |
| --- | --- |
| Foundation `context_source_versions` | `(source_id,fingerprint)` unique; owner/source composite FK; removed marker; JSON content and optional timestamps. No retained-stream validator or automatic tuple binding. |
| Foundation `context_results` / `context_result_sources` | Required owned attempt, recording subject/topic, reuse key, accepted nonnull normalized result and composite owner/version links. JSON presence is not field validation. |
| Foundation `context_documents` / `accept_context_result` | Current result FK binds owner/subject/topic; revision CAS; at least one live linked source; locks source/version rows and rejects removed/withdrawn evidence. No latest retained-row comparison. |
| `save_context_metadata` replacement in `20260920040000_context_guests.sql` | Hard-codes Spotify provider, Spotify recipe and confirmed zero cost; generic-looking arguments do not make it suitable. It preserves an explicit customer-assertion correction and uses max retrieval to guard ordering, insufficient for exact multi-run bundles. |
| Current `claim_context_enrichment` (20260924020000) and `complete_context_enrichment` (20260923070000) | Topic allowlist lacks streams; both require subject in request output. Expanded catalog members are outside that list. Completion requires declared URL/kind, present, non-null source content (empty objects/arrays still pass), a running attempt, and checks request scope; it does not validate retained rows. |
| API `contextTopicSchema`, `contextIngestSchema` | Stream topic absent; ingestion accepts Spotify track / YouTube locators. Do not disguise an internal retained-series locator as a supported ingest URL. |
| API `contextCoverageSchema` | Describes media duration/ranges; do not invent audio durations to represent calendar coverage. Stream coverage requires the owning strict schema. |
| `list_context_catalog_member_targets` / `resolve_context_catalog_member_recording` | Existing exact UUID identity plus current catalog/request membership. Reuse these facts; do not invoke expansion or add an ISRC→generated-UUID fallback. |
| `read_context_documents` | Reads direct request output subjects, not expanded members merely because an edge exists. Context must define the authorized expanded-member evidence read. |

The existing helpers treat versions/results as append-only evidence in their normal
write path; the base schema is not a universal immutable-row trigger or a retained
stream checksum validator. No new generic registration endpoint, independent store,
fake provider attempt, confirmed cost, collection execution or claim of paid work
is warranted. Context must name a truthful local binding attempt/recipe and unknown
cost status where actual collection cost is not established. The decision to create
that binding is separately authorized work, not a side effect of preview/read.

## Corrections, conflict and current authority

1. Re-resolve actor/workspace/catalog/current member and recording UUID; load exact
   retained tuples and existing run/catalog linkage under the owning authority.
   Bind an exact complete set for the chosen windows, not a caller-provided subset.
2. Require one provider recording ID across **all included latest tuples**, including
   null rows. Current GET can filter other identities for comparison; this binding
   proposal instead refuses that mixed set. A provider switch is an identity gap,
   not proof of fraud and not permission to select whichever ID yields a total.
   Preserve raw history; “quarantine” here means withhold, with no new stored status.
3. A newly retained value or null correction creates a different version/result.
   Compare the actual latest-per-date tuple set again before acceptance/read/save;
   timestamps alone cannot establish unchanged contents. Do not overwrite an explicit
   customer-assertion correction; retain the existing metadata-writer guard as a
   conservative refusal pending an owning correction disposition. CAS also rejects a late
   document writer. The old UUID remains historical and cannot be silently upgraded.
   Refuse read instability rather than claiming an atomic snapshot from chunked GETs.
4. Repeated equal-value collections that store no new rows preserve the same bundle;
   do not invent a new version or a fresher retrieval based on `latest_run`.
   If a provider switch replaces every date, there is still no existing owning
   reconciliation rule. Until a reviewed switch disposition exists, withhold the
   new series if its provider ID differs from the previously accepted binding.
5. Recheck current document/result/source/version and source-specific current tuples
   for every durable create/save/head/read/non-delete receipt reconciliation. Lock
   order must compose with Database126; do not add inverted source→chat acquisition.
   Private denials remain redacted. Ownership/membership changes never bootstrap
   authority from an old receipt, UUID, relevance attachment or saved chat text.

## Withdrawal using the existing Context operation

`withdraw_context_source(owner,source)` marks that source withdrawn, marks every
linked result withdrawn and clears affected current document pointers with a
revision increment. Removed versions are also excluded by existing readers. For
the proposed series key, this withdraws all bundle versions/results for that owned
series. It does not mutate/delete `catalog_stream_observations`, songs or identities;
retained provider rows remain historical subject to their current access rules.
Tracking disable is still not withdrawal; catalog-member removal revokes current
catalog selection but does not erase retained stream rows.

**Resurrection hazard:** the active-source unique index excludes withdrawn rows;
existing upserts can create a new active source at the same locator. Re-reading
retained rows must not recreate a withdrawn binding. Recommend refusing a new
binding whenever that exact owned series key has a withdrawal history, unless a
separate explicit source-owner re-publication disposition is accepted. No such
Luminate disposition/validator exists at these pins. Do not invent one or claim
existing `withdraw_context_source` prevents recreation by itself.

This withdrawal is Context projection withdrawal, not a newly invented provider
retention/deletion policy or retroactive erasure of downloaded exports/raw chat
history. The shared authorized projection and delete-only authority are Context's
work. No retention duration, cleanup worker or withdrawal HTTP route is introduced.

## Exact decisions / acceptance required before builder implementation

Root should accept or reject the proposed series granularity/topic, one-current-
window limitation, strict mixed/switch provider refusal, and default no-republication
rule above. Context owns strict bundle/field validation, truthful local-attempt
provenance, idempotent replay and atomic source/current-tuple checks composed with
its existing locks. Catalog must supply an explicit provider-switch disposition
only if such a case is later admitted; the source has none today. Current payload
bounds must be checked without truncation; Context must choose a binding byte limit
consistent with its command/consumer limits before accepting input.

`vectors.json` separates current runtime refusal from conditional proposed outcomes.
It covers exact and missing evidence, zero/null, corrections, stale tuples, mixed and
changed provider IDs, access loss, source removal/withdrawal/recreation, unrelated
version substitution and CAS/period changes. Context should port these examples into
its own protocol tests once the contract is adopted. No executable intake or test
that pretends to prove that intake is shipped in this handoff.

## Pinned source index

- [API normalizer](https://github.com/recoupable/api/blob/c1298deb6bb981543bf442d26a32def889e60d71/lib/luminate/normalizeLuminateStreams.ts), [saved read](https://github.com/recoupable/api/blob/c1298deb6bb981543bf442d26a32def889e60d71/lib/catalog/getCatalogStreams.ts), [comparison](https://github.com/recoupable/api/blob/c1298deb6bb981543bf442d26a32def889e60d71/lib/catalog/compareSpotifyDailyStreams.ts).
- [Foundation](https://github.com/recoupable/database/blob/6ae03a0cc71dc2ad3955594c9cfcb6156c3fb8b8/supabase/migrations/20260920010000_context_foundation.sql), [metadata writer](https://github.com/recoupable/database/blob/6ae03a0cc71dc2ad3955594c9cfcb6156c3fb8b8/supabase/migrations/20260920040000_context_guests.sql), [current completion](https://github.com/recoupable/database/blob/6ae03a0cc71dc2ad3955594c9cfcb6156c3fb8b8/supabase/migrations/20260923070000_context_enrichment_scope.sql), [current claim](https://github.com/recoupable/database/blob/6ae03a0cc71dc2ad3955594c9cfcb6156c3fb8b8/supabase/migrations/20260924020000_context_enrichment_reuse_binding.sql).
- [Retained stream schema/read](https://github.com/recoupable/database/blob/6ae03a0cc71dc2ad3955594c9cfcb6156c3fb8b8/supabase/migrations/20261009193000_catalog_daily_stream_tracking.sql), [current stream commit](https://github.com/recoupable/database/blob/6ae03a0cc71dc2ad3955594c9cfcb6156c3fb8b8/supabase/migrations/20261010040000_catalog_stream_parent_lock_order.sql).
