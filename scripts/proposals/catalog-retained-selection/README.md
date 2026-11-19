# Retained-field selection and inner consumer — inactive source proposal

This implements the existing `catalog-field-consumer-2207.md` inner contract only.
It is outside app/lib and routes. Missing authority ports return unavailable.
No SQL wrapper, grant, source write, Context identity creation, environment flag,
UI schema-v1 extension or outer wire version is supplied. Frozen raw-report
API1290/Database142 are a different source path and are unchanged.

`readRetainedFieldSelection` calls an injected current command reconciler with the
original authenticated actor, workspace, request, catalog and retention key. The
intended backing function is the private, source-only Database proposal
[`stream_binding_proposal.reconcile_retention`](https://github.com/recoupable/database/blob/1b892dd2671ba7e15e0c44b690fbfbe515b59fbd/proposals/stream-retention-writer-2207/writer.sql#L3),
which rechecks `read_binding`. It is not implemented or connected as a live API
transport here; the injected callback alone supplies no authentication proof.
The adapter validates the exact receipt/scope/key and projects its
genuine Context identities. Null, pending, malformed, mismatched or ambiguous
results cannot create a ready selection; operational errors are redacted errors.
No retain/expand/provider call, latest lookup, re-key or raw-report fallback exists.
This projection supplies a selection, not a currentness lease.

`consumeRetainedField` accepts only the explicit retained_field request and server
actor/session/chat/assistant context. The injected transaction port must authorize
that complete scope, pre-lock the whole batch in a qualified stable order, read
each exact selection using the existing source family, and keep locks through
callback evaluation. No production port is implemented here. Passing mocked data
to that trusted port does not prove source authorization. The actor is never
substituted with owner/workspace. Maximum eight unique subjects; all-or-nothing
refusal, exact registered method/query, current_streams only, 32KiB output cap.
It calls the existing pinned evaluator, then strips raw observations and identifiers
outside the inner projection contract. Unknown has no amount key; zero stays zero.
Caller order is preserved; the port receives a separate subject-sorted lock list.

The generated `fixtures/fieldContext.json` is the ready inner response without
`state`, as specified by the consumer contract. It is synthetic evidence for UI's
explicitly versioned offline envelope; no outer version is invented here. UI owns
projection/collection/text agreement and capability negotiation. This increment
returns typed values but does not implement a renderer or any disclosure path.

Pure tests run the actual selection adapter and evaluator with synthetic authority
ports, including withheld values on stale/missing/withdrawn boundary simulations.
The Database companion extends the actual existing retained-field integration
harness with a deferred current reconcile/read consumer. Those PostgreSQL scenarios
are not run under the SQL hold. Simulated refusal labels do not prove actual
withdrawal, memberships, transaction liveness or concurrent batch correctness.

Remaining runtime gates: real selection-source transport, actor/session/chat scope,
reserved-family writer enforcement, callable held-transaction evaluator transport,
qualified batch lock order, UI-owned envelope, and current authorization on initial
delivery/replay/persistence/history/reconnect/text/export/model reads. A successful
journaled preparation cannot authorize later disclosure; deny both typed values and
numeric/text projections together. No recomputation or new version under the same
saved source revision. The ordinary report stays separate and is never a fallback.
