# Optional retained artwork foundation — unwired candidate

This candidate advances app issues2273/2268 without adding a quoted item, provider stage,
reservation, model, cap or production registration. The production workflow and bounded
scheduler are unchanged. The caller must supply one already-admitted workflow's durable
ports before any hosted integration; no production Workflow registration is added.
Plan hashing (`createPlan`) and retained-file validation/hashing (`bindFiles`) are explicit
async ports because Node crypto and Buffer cannot run in Workflow scope. Their step
adapters call the unchanged `createPackFoundationPlan` and `bindPackFoundationFiles`
helpers; the latter reads retained bytes inside the step rather than serializing a callback.

`createPackFoundationPlan` selects an explicitly requested **existing quoted artwork**,
otherwise the lowest ordinal/ID existing quoted artwork. It rejects retry-only/stale
quotes, unknown dependencies and self-dependency. No quoted artwork is `none_requested`;
quoted artwork missing from persistence is `missing`. Neither creates a replacement.

Dependencies are explicit asset IDs, not a new default for every asset. All five current
kinds begin with `createPackProductionServices.generateImages`, which already supplies
`image_urls` to `buildImageInput`. That adapter uses its existing edit route for references.
The foundation adds a retained image reference to the same already-quoted image call;
it does not add another image-generation call. Original references remain and the existing
five-reference pack limit is enforced. Extra recipes, new provider capabilities and
incremental funding are outside this candidate. Provider expenses remain unmeasured;
using an already-configured edit route is not evidence of equal provider cost.

The persisted record lives at `production_context.shared_foundation`, through the existing
owner-scoped `read`/`context` command adapter. It preserves the completed audio context.
The existing production-context schema is shared unchanged with preparation. A pending
reference-capacity conflict may be saved before analysis without claiming a completed
context; ordinary readiness persistence requires the full valid context.
Its plan hashes the full quote, normalized original brief/direction, job/owner/revision,
selected asset and explicit dependent IDs. Readiness requires inspected completed artwork,
owned retained image files, existing MIME/10 MiB validation and hashes of their actual bytes. The asset digest also includes
its attempt, provider receipts, outcome and file hashes; temporary signed file URLs do not
serve as file identity. JSONB object-key order does not change those digests.

Before any dependent work, the ready record saves each dependent's expected original
attempt. Retained dependent work without a matching durable binding is rejected before
new foundation generation; it is never relabeled or regenerated. Replay checks the saved
quote/direction, actual foundation bytes/asset identity and dependent attempt bindings.
Signed reference URLs may be refreshed only after that identity check. Retained
reference storage keys deduplicate a reused foundation before signing, so a new signed
URL does not consume another reference slot; completed dependents need no refreshed inputs.

`runPackFoundationBatch` completes/persists the selected foundation before admitting
ready dependent IDs through the unchanged bounded scheduler. Independent pending IDs
remain eligible if the foundation is absent, failed or uncertain. Preparation failure
and identity conflicts fail closed. Existing completed assets and receipts are preserved.
A selected artwork already running is not claimed again. This is single-admitted-run
composition, not a cross-workflow lease.

## Deferred settlement is an explicit owner continuation

The current settlement command terminalizes pending/running items and refunds the
remaining hold. This candidate therefore **does not call settlement** while declared
pending dependents are blocked or an existing asset is still running. It does not renew,
create or release a hold. The returned status/action includes the saved `hold_expires_at`
and does not present deferred work as pack success:

| Condition | Existing continuation |
| --- | --- |
| Foundation in flight with a recorded expiry | Read the same job; await/reconcile the already accepted attempt. No new claim. |
| Missing expiry or conflicting retained identity | Read and reconcile saved state; no indefinite waiting promise. |
| No artwork requested or quoted foundation missing | Read/reconcile the hold before revising unstarted work or creating a new pack. No silent foundation generation. |
| Existing references leave no room within the five-reference pack limit | Read/reconcile the hold, then explicitly choose reference scope for a new quote/pack. No input is silently dropped. |
| Confirmed failed foundation | Read the job, request a fresh per-asset estimate and explicitly approve a retry. No automatic paid retry. |
| Uncertain foundation | Read and reconcile; existing resume requires accepted request ID and saved route. Missing acceptance evidence requires manual reconciliation. |
| Completed but unusable/inconsistent foundation | Read and reconcile; this is not automatically a retry-eligible failed asset. |

Existing `read` reconciles an expired running hold using existing settlement logic.
There is **no cancel operation** in the current pack API. Running/funded brief edits are
rejected, and produced brief changes require a new pack. A per-asset retry quote or changed
revision does not automatically resume this candidate: it only accepts the original full
quote. These boundaries are explicit rather than new funding or refund policy.

Offline tests cover selection, missing/zero artwork, foundation and persistence barriers,
shared bindings, replay, retained receipt/attempt conflicts, lifecycle results, the existing
context adapter, and actual image-adapter input shape with mocked provider calls. They do
not prove database deployment, hosted Workflow delivery, provider quality, licensing or
cross-pack creative acceptance. Production remains unwired.

## Compiled local qualification

`pnpm test:pack-foundation-workflow` compiles the actual composition and bounded scheduler
with the installed Workflow SDK. Typed synthetic step ports preserve the real planning,
file validation and digest helpers; persistence and generation are local fixture effects.
The runner reuses the scheduler fixture's local world, network denial, strict generated
TypeScript checker and polling/restart primitives without changing that shared harness.

For the six ordinary scenarios, it kills only its owned worker after acknowledged
foundation-outcome persistence at a journaled hook created after the persist step returns. It
restarts against the same local journal, explicitly re-enqueues, and resumes. Assertions
cover persisted dependent attempt/hash binding before dispatch, retained foundation and
independent receipts, failed/uncertain/missing/no-artwork deferred settlement, and lost
readiness acknowledgement failing closed. That seventh scenario saves readiness then
throws a fatal step error; it pauses at the final-result hook after the composition handles
the failure. It does not claim a crash during a persistence effect. Terminal replay must not repeat any recorded
effect. A synthetic environment sentinel satisfies the constants module's import guard;
no real credential is supplied or required. Quote amounts and holds remain unchanged fixture values.

This qualifies local compiled orchestration with synthetic durable ports. It does not
qualify hosted recovery, production persistence adapters, crashes during provider/SQL
operations, cross-workflow atomicity, model quality or production admission/cap policy.

The fixture has its own initializer-specific process-lifecycle wrapper. The shared runner
is not generalized in this contribution because it is also used by concurrent work;
its local-world, network-denial, polling and strict-type primitives are reused unchanged.

## Unwired server and durable bindings

`app/workflows/packs/foundation/createPackFoundationServices` binds the existing
preparation, claim/production and no-retry settlement steps to the coordinator. It is
not called by the production workflow, which remains sequential. The caller must use
the same server-resolved actor and job for both factory and coordinator; scope mismatches
fail before effects. No public tool, route, dispatch path or funding policy is added.

The first durable read calls the existing owner/org-scoped RPC and requires a running
job whose saved workflow ID already matches Workflow metadata. It never calls `run` to
establish or repair admission. The existing dispatcher starts a Workflow before recording
its run ID, so this candidate can observe a missing ID and fail closed. Admission ordering
and that failure's owner continuation must be qualified before any production wiring.

The reused `preparePackStep` still records `run`, reads, and calls the existing preparation
helper. That write is unchanged existing behavior, not additional ownership protection.
The initial admission check and later binding/signing checks are point-in-time checks,
not a lease: existing prepare/claim/settle operations do not atomically fence another run.
Cross-run takeover and time-of-check/time-of-use behavior are not qualified by this slice.
The factory is intended only for the already-admitted single-run coordinator contract.

Planning calls the existing planner inside a Node step. Binding re-reads authorized
admission and compares the complete current plan and asset before calling the existing
file binder. Bytes are fetched from an existing storage-key signer through `fetchPackMedia`;
temporary URLs supplied in file metadata are never downloaded. Existing ownership,
byte-length, MIME, size and hashing checks remain in the binder. Signing re-reads admission
and requires matching key/type/size in the job's retained usable artwork before invoking
the existing storage signer. Reference URLs use the existing preparation lifetime of
86,400 seconds, with a finite future hold expiry strictly inside that lifetime. Missing,
invalid, expired or overlong expiry fails closed; no hold is renewed. Thus replayed
references outlive claim admission within the validated hold, including delays beyond
one hour. This does not guarantee arbitrary delays after claim or provider-side fetching;
claim, submission persistence and provider fetch are not atomic. The one-hour binding-read
URL is consumed immediately inside its step and is not passed to dependents.
Explicit actor/job arguments cross those step boundaries;
no callback or service object is passed as a durable step argument.

Persistence checks admission and invokes `savePackFoundationRecord`, preserving its
existing context schema and owner/quote validation. Every new step and reused effect step
has `maxRetries = 0`. There is no automatic provider retry or fallback. Failed reads,
admission, preparation, retained downloads and readiness persistence leave the coordinator
in reconciliation with no guessed settlement. Existing reads may reconcile expired holds
under the unchanged database contract; this adapter introduces no new refund action.

A known five-reference conflict still persists its pending selection requirement before
preparation/provider work and defers settlement. It does not silently drop inputs, renew
a hold, invent cancellation, or resume a changed quote. Admission ordering, a separately
qualified production concurrency bound, deferred-hold owner continuation, and hosted
integration remain prerequisites for wiring. No commercial or model decision is made here.

The durable-port tests invoke the actual RPC wrapper, step/domain functions, context
adapter and storage signer with mocked database/storage/provider boundaries. They verify
owner/org/job forwarding, real retained-byte hashing, exact signing inputs, persisted
attempt binding before dependent claims, failure/no-retry behavior and retained replay.
They do not execute SQL, authenticate a real account, fetch real storage, or call providers.

A separate compile-only check combines the actual coordinator and actual factory with
the installed Workflow compiler. It does not shadow these steps, start a workflow,
execute step modules, or call a server. Compilability and mocked adapter behavior are
separate evidence from the earlier synthetic-port restart/replay fixture; a hosted run
using these real bindings remains unqualified.
