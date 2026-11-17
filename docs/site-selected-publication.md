# Unwired exact-selected Sites publication

This source extends the evidence adapters from API #1263. It targets the unchanged
**Database #136 proposal**, commit `4caac3cc8a15a47b348109b2fa4f571423d8beb0`.
There is no route, UI, MCP or workflow caller. Existing `processSiteOperation`
publishing remains advisory and unchanged. No migration, schema exposure, runtime
grant, retention activation or publication gate is introduced.

## Selection and explicit intent

`publishSelectedSiteEvidence` accepts authenticated server account context and a
stable server operation key separately from its strict input schema. The input
contains expectations: site, owner, artist, revision, candidate digest, explicitly
nullable expected publication evidence pointer, and optional signed generation
token. These values do not grant access. The server reloads and authorizes the site
and resolves the actual draft or signed/current-generation working build. A new
preview under the same revision must still match the selected digest. Missing
`published_evidence_id` metadata is an error, never silently interpreted as null.

The input chooses either a stored review ID or explicit
`publish-without-passed-review` intent with a nonblank reason. The existing Publish
click/request is not accepted as override intent. No candidate, report, actor,
record timestamp or operation key comes from request-body evidence. There is no
new mandatory artist approval.

Only after matching selection and authorization does the override branch call the
proposal's create-once capture RPC. It preserves the original candidate and shared
canonical projection/serialization. SQL owns the ID/time; returned identity,
actor, intent and reason are validated. Capture conflicts propagate without
replacement keys. A retained override record can exist even if a later authority
check or publication fails; recording intent does not mean publication succeeded.

The review branch reads its scoped immutable record and preserves original review
and execution hashes. Both branches run the full existing
`assessSitePublishEvidence` predicate. A failed review never falls back to an
override. The server resolves the selected candidate, checks authority and reads
and assesses the evidence again before `publish_candidate`. The SQL call receives
only actor/owner/site/revision/record ID/selected digest/expected pointer; SQL copies
the stored immutable candidate, not API-supplied replacement bytes.

## Existing authority and deliberate unsupported transitions

The current `processSiteOperation` publish branch checks workspace and revision,
uses `readPublishableBuild` for a signed generation, revalidates a saved Context
brief when present, resolves artist attribution, calls `prepareSiteFanConnection`
and rechecks workspace before its legacy publication update.

The new, unwired path reuses these read/check owners:

- `authorizeSiteWorkspace` and `readPublishableBuild` for actor/workspace and signed
  current-generation resolution, repeated at the final boundary.
- `readSiteContextBrief` for the selected snapshot's saved brief when present,
  repeated before publication. This preserves the existing brief-optional source
  contract; it does not create new Context evidence or provider analysis.
- Existing artist/workspace association checks (the same organization versus
  personal-access distinction used by site creation), plus artist name lookup.
- The existing active-paid-subscription predicate, extracted into
  `readPaidSiteSubscription`. The old fan-request helper retains its 30-second
  cache; the new path uses fresh reads at both authority passes. The underlying
  Stripe reader continues to fail closed to no entitlement on provider errors.
- `getFanOAuthConfig`, `selectFanConfig`, and the extracted shared
  `resolveSiteFanReturnUrl` transformation/validator used by existing preparation.

Two existing side effects cannot safely be included in this proposal: automatic
artist attribution and creating/updating fan configuration. SQL preserves
`artist_id`, so this path requires a nonnull existing artist matching the selected
artist and rejects transitions. It also requires an already enabled fan
configuration for the exact destination; it does not call `updateFanConfig` or
silently claim to have prepared one. These restrictions belong only to this
unwired source, not the existing advisory publish flow.

## Atomicity and activation gates

The SQL proposal serializes workspace membership, revision, evidence binding and
publication-pointer CAS. The external paid, Context, artist, fan configuration and
Workflow reads are **not atomically serialized with that transaction**. A changed
selection or pointer observed by the final recheck is rejected, but changes after
that observation are not prevented by API reads. In particular the proposal does
not compare an expected artist ID or the latest mutable Workflow preview inside
SQL. An artist change after the final read can therefore commit before publication;
receipt validation can detect it only after publication has already committed.
Artist/current-generation race handling and exact preview interaction must be
resolved before activation; this source is not complete end-to-end publication
authorization. Pointer CAS also does not solve ABA or order multiple legacy writes
that leave the pointer null; see the proposal protocol.

Publication receipts are checked for site/owner/artist/revision, evidence ID,
actual published-content digest and unchanged evidence. The site row's raw SQL
`published_at` can contain an offset and is validated accordingly. Evidence
`recordedAt` still uses the proposal's explicit six-fractional-digit UTC-Z format.
A receipt/transport error may occur after SQL committed; it propagates without an
automatic retry, fallback or rekey. Future interaction must resolve ambiguous
outcomes by an authorized read, not assume the site stayed unpublished.

Required next gates remain separate: reviewed exact-selection/override UI intent,
artist/fan preparation transitions, external authority race policy, approved SQL
release/admission/grants and retention, authoritative pointer availability,
production integration and end-to-end validation. Database #136 remains draft and
proposal-only. Source merge alone does not satisfy any of these gates.

## Validation scope

Tests use mocked repository, Stripe, Context, authorization and Workflow
boundaries with the actual candidate identity and complete evidence predicate.
They cover same-revision preview changes, null versus missing pointer, final-boundary
revocation, explicit override capture, mismatched receipts, original report/artifact
digests and RPC argument/error contracts. Existing working-preview, capture,
assessment and fan-configuration tests remain regression checks. No live provider,
DB, browser, native share, fan OAuth or publication execution is claimed.
