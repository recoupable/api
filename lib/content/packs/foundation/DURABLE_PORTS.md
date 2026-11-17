# Unwired server and durable bindings

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

`node scripts/pack-foundation-durable-ports-compile.mjs` (also run in CI) combines
the actual coordinator and actual factory with
the installed Workflow compiler. It does not shadow these steps, start a workflow,
execute step modules, or call a server. Compilability and mocked adapter behavior are
separate evidence from the earlier synthetic-port restart/replay fixture; a hosted run
using these real bindings remains unqualified.
