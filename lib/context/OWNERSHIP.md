# Context ownership fixture coverage

This guide describes source-level acceptance tests for Context2120. It does not
qualify an intended-account web/MCP/native session, production data isolation,
workflow deployment, or transaction-level revocation.

## Identity and scope exercised

`ownershipParity.test.ts` invokes the real HTTP handler, registered standard MCP
callback, domain dispatcher and owner authorization. Credential lookup and
organization membership are mocked, as are private storage/dispatch boundaries.
Every current operation schema must produce a valid bounded synthetic input.
The organization scope is distinct from the authenticated actor. Authorized
calls assert the workspace owner at each reached sink and the authenticated
actor wherever that sink takes one; HTTP and MCP must make identical sink calls.
The fixtures exercise dispatch for ingestion and release verification, and
saved-document selection for briefs. Null responses on other read paths test
scoping and matching failures, not successful completion of every operation.

Denied membership stops HTTP at its transport check and MCP at domain entry.
A domain denial after HTTP's membership check must return an opaque non-success
on both transports, without the private denial canary or organization ID. No
mocked private sink may run. These tests do not pin an exact denial envelope or
status beyond HTTP client-error semantics. Current logging is also checked for
the denial canary. They do not simulate another customer's stored content in
caches, exports, snippets or every response shape.

`oauthContextParity.test.ts` derives the delegated subset from current policy,
uses real Context registration plus `registerFullOAuthTools`, and verifies
per-action schemas, annotations, action reinjection, current-token verification,
authenticated account forwarding, owner-scoped sink calls and opaque domain
denials. The grant verifier and preparation service are injected fixture
boundaries; preparation/resource policy is not qualified by this suite. Existing
`registerFullOAuthTools.test.ts` covers revoked, limited and mismatched grants;
`contextToolOperations.test.ts` covers the full operation metadata mapping.
Existing catalog-case/evidence transport suites cover their standard-only
exclusions; this suite does not make those actions available to OAuth.

At the reviewed base, the matrix contains 33 operation schemas and 27 delegated
operations. These are a dated source observation, not a fixed capability count:
the tests derive their cases from current schemas and fail if the bounded
fixture builder cannot satisfy a new field. The builder does not invent runtime
contracts or generate UI/tool stubs.

## Worker checkpoints exercised

`workerRevocationParity.test.ts` adds these cases with a real recorder, scheduler
and execution wrappers behind a mocked RPC boundary:

- Both release workers: revocation before execution authorization rejects before
  creating an execution, fetching credentials or dispatching collection.
- Both release workers: revocation after execution creation fails node
  authorization, saves one generic `failed`/`authorize` outcome and resolves.
  No node claim, credential fetch or provider dispatch occurs. No persisted RPC
  parameter includes private denial detail.
- Enrichment: queued denial prevents a claim and provider call. Denial after a
  simulated provider return prevents completion and records only the owner and
  attempt in the failure mark. This does not prove zero spend or rollback.

Existing `spotifyPipeline.test.ts` and `guest.test.ts` revocation cases are
strengthened with exact actor/owner checks and failure-record opacity instead
of duplicated. The adopted guest worker derives actor/owner from its scope RPC;
unadopted guest capability handling remains covered by its existing tests.

Existing `briefSnapshotTransports.test.ts` covers revocation during brief
compile/save/read and withholding of output. Existing planner tests cover
entry denial; the blocked-plan review step checks access at planning start,
which is not a transaction-wide membership lock. Existing workflow tests
preserve failed/cancelled returns and thrown-error behavior (API1219).

## Limits

All observations come from in-process calls with synthetic inputs and mocked
external boundaries. A worker can throw the original internal denial while
customer-readable persisted outcomes remain opaque. These tests do not prove
runtime log privacy, database row policies, in-transaction actor locks, private
storage retention/deletion, cross-customer exports, hosted token issuance,
actual client discovery, or revocation between a final check and a database
commit. Those require their own evidence and acceptance. No migration, feature
gate activation, provider call or production permission change is part of this
change.
