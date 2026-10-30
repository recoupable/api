# Retained stream FIELD/RECIPE offline contract

Status: October 27, 2026, executable computational proposal only. No endpoint,
client codec, provider fetch, retention write, migration, grant, or live ObjectRef
mapping is introduced. Root review is required before App consumption.

Run from API root:

```sh
pnpm exec vitest run scripts/proposals/catalog-stream-fields/recipe.test.ts lib/catalog/__tests__/compareSpotifyDailyStreams.test.ts
pnpm exec tsc --noEmit --project scripts/proposals/catalog-stream-fields/tsconfig.json
pnpm exec eslint scripts/proposals/catalog-stream-fields --ext .ts
```

## Input and trust boundary

`evaluateRetainedStreamField` accepts an unknown value and strictly parses every
object. Only operation `read_field`, recipe `catalog-retained-stream-fields/1`,
and the four fields in `recipe.json` are admitted. No caller authority boolean,
financial field, annualization, Spotify label, extra field, or writer operation
is accepted. Evidence provider is exactly `luminate` and scope is daily streams,
all DSPs, worldwide, UTC.

`selection` contains the saved owner, recording subject, request, catalog, result,
revision, topic, exactly one source-version UUID, and query. A supplied qualified
boundary envelope must match all binding values exactly. The query must reconstruct
both evidence periods exactly. The full result binding accompanies the returned
ObjectRef: that bare reference alone does not confer field authority.

The boundary is supplied by the test harness. `qualified` is **not authentication**
and this exported offline function must never be exposed directly to clients.
An integration must obtain evidence through the independently qualified source
boundary. This module cannot prove actual owner access, membership, accepted result,
latest retained rows, run-range linkage, version immutability, withdrawal history,
or consistency during concurrent reads. Those are source-boundary responsibilities.
Context separately owns retention writer/CAS/retry/rollback/current-source enforcement.

The source contract used here is the reviewed
[API1188 retained-stream evidence document](https://github.com/recoupable/api/blob/8ef93a0d007ad5058fb748328a05788f3f43e4d5/docs/contracts/retained-stream-evidence-2207.md),
paired with the reviewed
[Database127 protocol](https://github.com/recoupable/database/blob/6560ca76b048c4964335d2a8a282b34e59001bfc/proposals/stream-evidence-binding-2207/PROTOCOL.md)
and its [executable SQL proposal](https://github.com/recoupable/database/blob/6560ca76b048c4964335d2a8a282b34e59001bfc/proposals/stream-evidence-binding-2207/proposal.sql).
These immutable links identify the exact reviewed sources underlying root's adoption;
Database repository access is required for the protocol and SQL. Adoption is limited
to the evidence contract, not live source mapping or this field evaluator.

Root reported merges [API1188](https://github.com/recoupable/api/pull/1188)
(`d9683853c8471423c5aa763bf60270bee5b89ff7`) and
[Database127](https://github.com/recoupable/database/pull/127)
(`7160086321f16db8a1d4f09c721d3928ade042f6`). The reviewed source commits above
were locally available; the API merge object was not. This branch was replayed onto
locally available main `08f62b7474e52b2bd0114d2d2c62c642c17ef6bf`, which does not
contain the API1188 document. No source fetch was performed.

The [Catalog31 fixture file](../../../docs/contracts/catalog-stream-evidence-2207/vectors.json)
is unchanged from API1187 head `b185ea9ded070cd6d621d2bf13843bf9df6e5a8f`.
Its historical design-only status and accompanying recommendation remain intact;
they are test inputs, not the authority for adoption. The source documents linked
above define the evidence envelope consumed by this offline qualification.

## Field semantics

| Field | Unit | Meaning |
| --- | --- | --- |
| previous_streams | streams | Sum of the previous period |
| current_streams | streams | Sum of the current period |
| absolute_growth | streams | Current minus previous; negative is allowed |
| percentage_growth | percent | Canonical relative change; unknown at zero baseline |

All fields carry both exact half-open UTC periods, scope, retrieval range, retained
observation tuples, result/revision/source-version binding, and explicit evaluation
clock. Periods contain 1..366 days each and must have finished by `asOf`. A fixture
clock does not certify current provider freshness. Provider publication time is unknown.
Currency is always null. There is no financial conversion or annual extrapolation.

Absent dates and stored-null dates stay distinct in coverage. Either makes the
comparison incomplete and **all four amounts null/unknown**, never partial sums.
Observed zero is known. A complete zero previous period yields a null/unknown
percentage with `zeroBaseline: true`; other fields remain known.

The implementation directly calls unchanged
`lib/catalog/compareSpotifyDailyStreams.ts`; no formula is copied. It refuses unsafe
counts, unsafe period sums, and unfinished periods. Percentage is the helper's raw
binary64 result without intermediate or display rounding. Operation order matters:
`(1 / 3) * 100` differs in its last binary64 digit from `100 / 3`.

Rows must be sorted and unique by date, within the exact periods, and match the
catalog, ISRC and single provider recording ID. Hashes must be 64 hex characters.
Reconstructed absent/null lists and minimum/maximum retrieval instants must match.
Strict parsing rejects extras, NaN, string schema versions, and multiple versions.
At most 732 observations are accepted. Compact JSON UTF-8 content/envelope limits
are 524288/786432 bytes. These local transport checks do not reproduce PostgreSQL
JSONB text/storage checks; both source limits remain separately required.

## Recipe identity and integration handoff

`recipeHash` is SHA256 of the exact checked-in `recipe.json` bytes, including its
trailing newline. `helperSha256` pins the actual canonical source file; a changed
helper refuses computation. The manifest is descriptive, not a signature or source
version. An adopter must pin the reviewed commit, evaluator bytes, manifest hash,
and helper hash together. Changing any contract behavior requires a reviewed recipe
revision. A hash alone never proves authority or creates a Context version UUID.

Ready output is a detached validated projection. Mutating its observations does not
mutate the supplied evidence. Refused output contains only state and reason; source
unavailability and error are distinct. Internal refusal reasons are for offline
qualification, not an unauthorized public error response. Full provenance is offline
review material, not a proposed chat data-part or saved-control payload.

## What the 31 fixtures prove

Eight conditional-ready cases check all four amounts, unknown/known states, coverage,
zero baseline, exact ref, unchanged input, and invocation of the real helper.
Some ready fixtures deliberately produce unknown amounts. Twenty-three cases refuse.
The following eleven use a supplied `unavailable` boundary outcome: correction not
bound, all dates changed provider, workspace revoked, member removed, unresolved
recording, source withdrawn, version removed, attempted recreation, unstable read,
arbitrary caller tuple, result not accepted. Storage failure supplies `error`.
Late writer CAS loss and customer correction request the unsupported writer operation.
The remaining nine refuse on local contract, binding, or observation validation.
These fixtures verify propagation; they do **not** independently prove authorization,
withdrawal, concurrency, or writer behavior. All 31 remain unsupported as live mappings.

Additional tests pin helper bytes and cover tampering, overflow, unavailable/error,
provider/scope relabels, percentage precision, output isolation, 732 dates and UTF-8
size overflow. Independent review is part of the PR qualification.
