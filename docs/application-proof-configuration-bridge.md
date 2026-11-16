# Registration-shaped proof configuration bridge

October 27, 2026. **Offline rehearsal; not an API, registry writer or activation.**
Related: [application registration #2104](https://github.com/recoupable/app/issues/2104),
[API proof proposal #1189](https://github.com/recoupable/api/pull/1189), and
[Database receipt prototype #128](https://github.com/recoupable/database/pull/128).

## Current source gap

API base `31d28cd7ac88ebc62d567a11c8ff452acb1369ea` still exposes only registration
preflight. `lib/applications/applicationRegistrationSchema.ts` accepts `name`,
optional `organization_id`, `environment`, `allowed_origins` and `return_urls`.
The shared `validateApplicationRegistration` returns a validated proposal with
`persisted: false`, `origins_verified: false` and workspace/billing attribution.
It does not supply an application ID, saved parent configuration or revision token.
HTTP and MCP already share this validator; neither transport is changed here.

Database base `a118b020911222e88d1c254c1babfbd60de370a1` has an executable proposal,
not deployed tables. Its `transact` supports issue/verify/revoke/read and synthetic
parent revisions, but **has no configuration-update operation**. Calling it with a
new operation name would fail. This rehearsal cannot invoke that SQL as a writer.

The concrete gap addressed here is mapping the real preflight shape to a bounded
return-URL change for already-known origins, and preventing absent authority from
reaching even a fixture invoker. New origin creation/removal and parent metadata
writers remain absent. No unused production-domain export, transport, persistence,
DNS request, permission grant, provider callback edit or account creation is added.

## Narrow input and mapping

`scripts/application-proof/rehearseConfigurationInvocation.ts` calls the actual
validator, not a copied parser. Its account argument represents already-authenticated
server context; tests use synthetic UUIDs and mock only organization membership.
A separately selected application UUID scopes the fixture operation. It is not
injected into or added to the registration body and does not prove resource access.
A future public target selector still needs real authorization and resource lookup.

| Preflight field | Mapping / permitted rehearsal behavior |
| --- | --- |
| `organization_id` | Validator resolves workspace membership/access; no application-management grant follows. Must match the independently loaded parent workspace. |
| `environment` | Exact production/development binding; cannot move a saved parent between environments. |
| `allowed_origins` | Must equal the complete existing origin set, ignoring array order. No addition, removal, alias, normalization or wildcard. |
| `return_urls` | Group by exact canonical URL origin. Compare sorted sets; query strings remain part of the exact destination. Only changed origins receive an update plan. |
| `name` | Must remain unchanged. A name-only update needs its own parent metadata writer and concurrency contract. |
| Proposed billing owner | Never an input to this bridge or a mutable field. It remains validator attribution; no allowance, purchase or spending policy changes. |

The fixture snapshot carries workspace/application/environment, the existing
registration fields and exactly one revision row per allowed origin. It must pass
the real canonical-origin/return-URL validation, contain no duplicate/missing/extra
origin rows, have positive safe-integer revisions, and contain no revoked origins.
Unsafe revision increments are rejected. Revoked or absent parents are not recreated.
The snapshot is synthetic trusted-adapter output, not evidence of actual persistence.

For an affected existing origin, the plan is:

| Value | Expected → next |
| --- | --- |
| Configuration revision | N → N+1 |
| Origin proof revision | P → P (historical DNS observation unchanged) |
| CAS revision | C → C+1 |
| Return URLs | Exact replacement list for that origin; may be empty if another origin retains a destination |

Unchanged origins have no mutation. Reordering lists is a no-op and does not call
the invoker. Multiple affected origins are one proposed atomic batch, sorted by
origin; there is no partial success path. A configuration bump invalidates pending
challenge observations tied to the old configuration even though proof revision
is unchanged. Historical proof receipts remain immutable and access-disabled.

The broader parent mutation map remains a specification, **not implemented** here:
new origin → new exact parent with initial revisions and no proof; removed origin →
configuration/security invalidation, pending-challenge revocation and proof/CAS
advancement in one adopted registry transaction; workspace/environment transfer →
new binding with no inherited proof. Re-addition of a terminal revoked origin needs
an explicit new lifecycle identity/revision contract. This rehearsal rejects all
of these instead of guessing how to create or restore parents.

## Default-denied authority and invoker contract

After real syntax/workspace preflight, the default authority adapter is absent,
which rejects with `Management authority unavailable`. No parent-snapshot read or
invoker call occurs. A positive membership result, account equality, publishable
app ID, boolean `true`, or throwing/unavailable adapter never supplies management
authority. No production management role or delegated OAuth scope is selected.

Only explicit test injection can return the exact `fixture-only-authority` marker
with the matching actor/workspace/application/environment/operation tuple. That
marker is an executable-fixture convention, **not a credential or policy grant**.
It must never be accepted from a client or promoted into a runtime adapter. Its
operation label describes this test's intent; it does not expose a new OAuth scope.

The fixture invoker receives the entire expected parent snapshot plus sorted
changes and all expected/next revision triples. Copies separate adapter arguments
from the caller's comparison baseline. Missing invoker, revision conflict or
commit-time authority rejection propagates as failure, without blind retries.
The only accepted fixture acknowledgment has the identical plan, `persisted: false`,
`bootstrap_enabled: false` and `access_activated: false`; altered or truthy activation
claims are rejected. A no-op returns the same disabled result without invocation.
These checks cannot undo a malicious adapter's side effects: injection is restricted
to in-memory tests, and there is no actual database adapter in this change.

Before implementing a real Database configuration writer, it must:

1. Reauthorize the authenticated actor inside the transaction. API membership or
   this rehearsal's marker is insufficient; real policy is still unadopted.
2. Lock parent application/environment configuration before all affected origin
   rows in stable order. The complete origin set must be protected against concurrent
   additions/removals, not just the rows that happened to exist in the snapshot.
3. Compare the entire expected snapshot, including origin membership, name, exact
   return URLs and **all** revision triples. A different current baseline conflicts;
   never silently rebase a full-set request onto a newer parent.
4. Check current suspension/revocation, invalidate old pending observations, and
   update every changed return-URL list/configuration/CAS revision atomically while
   preserving proof history. No origin becomes active or verified through this write.
5. Add durable scoped idempotency and original-receipt recovery for unknown outcomes,
   with conflict checks on changed payloads. This rehearsal does not mint keys,
   persist retry receipts or retry an invocation after an ambiguous failure.

Those semantics require a separately reviewed Database operation, parent mutation
lock protocol and real two-connection tests; the existing single-origin proof RPC
is not evidence that a multi-origin configuration batch is safe. A future invoker
must read current revisions and reject changes even when only an unchanged origin
was concurrently edited. The current tests verify the envelope/error propagation,
not database serialization, DNS control or authorization enforcement.

## Qualification and next gate

Run:

```sh
pnpm exec vitest run scripts/application-proof/__tests__/configurationInvoker.test.ts
```

Tests use the real preflight and explicitly injected in-memory fixtures. They cover
default/malformed authority, membership without new authority, spoofed input,
exact parent binding, return-URL revision projection, order-only no-op, terminal or
malformed snapshot, unsupported parent changes, absent invoker, propagated stale or
revoked-authority failure, and rejected activation/result mismatches.

Root reviews this narrow contract before selecting a real parent writer or exposing
any API/MCP operation. Management/delegated policy, resolver/hostname eligibility,
registry mapping, database authority/lock/idempotency checks, consumer revocation
and activation remain separate gates. Existing #2110 hosted/provider/mobile/shared-
callback acceptance and #2345's browser hold are unchanged. Existing receipts and
serving checkouts are preserved.
