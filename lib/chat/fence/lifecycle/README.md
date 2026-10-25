# Disabled phase-aware Stop/resume adapters — 2026-10-25

Base API: `544493e110b2813bd85c68f92ef68628ccee3027` (accepted internal workflow
branch). Contract/harness: exact Context SQL
`61d8b530f8b960b32402f4dd1f0d0a8f4f83d76e`, tree
`08bbb524033e34238ab6f4cf96dd1be581d874a0`.

No route, MCP tool or existing workflow imports these adapters. There is no enable
flag, enrollment, public field, cancellation call to a real provider, database
apply, secret cleanup, or resource/recovery authorization implementation.

## Captured target and outcomes

The caller supplies an already-authorized **original** target: chat, effective
account, epoch, owner, phase and original bound run (null for pending). The adapter
validates and freezes a flat copy before asynchronous work. This shape is not an
authorization grant; the future producer must establish actual resource access.

For a running target, SQL `state` is used only to compare the captured identity.
A closed, pending, mismatched or unreadable current state returns 503 without SDK
lookup. The adapter never replaces original authority with the observed owner or
run. A race after this check can still occur: SDK operations therefore use only
the original run, and release always uses the original epoch/owner/run SQL fence.

| Condition | Stop | Resume | Ownership/effects |
| --- | --- | --- | --- |
| Captured pending reservation | 503 | 503 | No SDK call and no SQL command |
| Stale/closed/mismatched or unreadable current state | 503 | 503 | No cancellation/release; never follow new owner |
| SDK cancellation throws | 502 | Not applicable | No release |
| Terminal polling fails or times out | 504 | Not applicable | No release |
| Status missing, unknown or read fails | 504 after Stop polling/final probe | 502 | Never fake successful completion |
| Original run remains live | Wait for terminal after cancellation | 200 SSE | Reconnect only original run; disconnect cancels only the reader |
| Authoritative terminal status + scoped release acknowledged | 200 stopped:true | 200 finish-only SSE | Original token only |
| Release rejected, malformed, failed or transport-ambiguous | 503 | 503 | No success claim or retry/new-owner adoption |

`releaseFencedTerminalRun` obtains a fresh SDK terminal-status observation itself;
callers cannot pass a fabricated terminal-proof boolean. It accepts only the
existing terminal statuses (`cancelled`, `completed`, `failed`). Missing-run or
status errors are not authoritative terminal or no-start evidence.

Stop reuses `waitForTerminalRunStatus`: its existing 8-second polling loop retries
completed failed/unknown probes. It does **not** impose a separate timeout on an
individual SDK promise that never settles. No stronger provider-deadline guarantee
is claimed here. The final authoritative probe is also subject to SDK completion.

## Pending no-start race: deliberately blocked

A read of `admission_snapshot.dispatch.status = never_attempted` is not permission
to stop a pending reservation. `claim_dispatch` can succeed immediately after that
read. SQL61d8 still accepts pending `confirmed_no_start` release after such a claim.

The disposable SQL control reproduces exactly that sequence. The adapters issue
**zero** commands for pending targets, return 503, and preserve the claimed
reservation so its delayed original run can bind. They never emit
`confirmed_no_start`, inspect dispatch history to infer no-start, or attempt a
compensating release. The control release exists only in the local test harness,
not in adapter behavior.

Context owns the proposed atomic unattempted-close CAS. Pending Stop remains
blocked until its exact interface is accepted and separately qualified. An
acceptable no-attempt operation must atomically check original authority and
unattempted dispatch under the same serialization as `claim_dispatch`; a prior
observation is insufficient. Independently authoritative external no-start proof
is a different fact and is not constructed by these adapters or by a missing SDK
status. No new external-proof path is implemented here.

## Actual current handlers inspected

- `handleStopChatWorkflow` authenticates with `validateStopChatWorkflowRequest`,
  returns 503 for `pending-*`, calls `getRun(originalId).cancel()`, returns 502 on
  cancellation error, waits for terminal status (504 on failure), and performs a
  best-effort legacy slot CAS. Its terminal success can survive failed CAS.
- `handleResumeChatStream` authenticates with `validateChatOwnership`, parses
  `startIndex`, reads `getRun(activeStreamId).status`, returns 502 on failed status,
  best-effort clears terminal slots and returns finish-only SSE. It currently has
  **no pending-reservation guard**, and does not explicitly reject unknown
  successful status values. This PR leaves that production handler unchanged.
- `getChatWorkflowReadable` owns the reader completion promises and subscription
  cancellation. `wrapWorkflowStreamWatcher` handles tool completion and status
  polling. Existing handlers retain the legacy/explicit-stop-v1 disconnect
  negotiation; the disabled fenced resume adapter always sets
  `cancelOnDisconnect:false` and never invokes workflow cancellation on disconnect.
- `reconcileExistingActiveStream` already preserves pending reservations and
  unknown/status-read failures. Its legacy CAS is not a fence release.

Tests invoke the actual existing Stop/resume handlers and these adapters through
mocked SDK/database boundaries to compare accepted 503/502/504 error bodies and
terminal finish-only shape. No production handler or shared helper was modified.

## Minimal later wiring sequence (not implemented)

1. Preserve existing authenticated ownership validation before any target
   construction. Resolve the intended original admission and its bound run in a
   trusted internal producer; preserve that target across asynchronous work and
   retries. Never resolve a fresh current owner as error recovery. There is no
   public epoch/owner/run field or producer in this PR.
2. Gate any later use on approved enrollment/resource authorization and the
   original credential/recovery design. Ordinary chat ownership observations are
   not a fabricated permission version, execution grant or recovery authorization.
3. At the Stop handler's existing active-stream decision, route the approved
   fenced target through `stopFencedChatWorkflow`. Pending stays 503 under61d8.
   Replace legacy CAS only for this branch with acknowledged scoped release;
   unlike the legacy best-effort clear, uncertain release cannot yield stopped:true.
4. At resume, after ownership and index validation, use the captured target before
   any SDK lookup. Require the existing explicit-Stop client protocol for fenced
   streaming; keep legacy clients' current behavior untouched. The adapter owns
   original-run headers/reader cleanup and does not call `start` or materialize
   credentials. A resume request reads an existing stream, not a new workflow turn.
5. Keep failure/ambiguity for reconciliation with the original target. Do not
   clear another owner, retry cancellation against a newly observed run, infer
   terminal state from missing status, or revoke a secret as a side effect.
6. Add pending cancellation only after Context's atomic no-attempt operation is
   accepted; distinguish it from externally proven no-start. Qualify claim/close
   interleavings, ambiguous responses and retry receipts before enabling it.
7. Separately qualify Stop/edit/backfill and live client/provider behavior before
   production activation. These source adapters do not implement those workflows
   or establish credential cleanup/recovery safety.

## Evidence and reproduction

- 29 new unit/trace tests cover captured authority, invalid reservation IDs,
  pending, stale/closed state, cancellation/status/release errors, input mutation,
  status/owner races, real SSE reader cancellation, and actual-handler contracts.
- `sqlLifecycleTrace.test.ts` emits nine actual adapter command traces with
  synthetic SDK cancellation/status evidence and API-generated admission bytes.
- `scripts/chat-fence-lifecycle-fixture/test-sql.py` loads unchanged SQL/harness
  through pinned `git show`, using a disposable socket-only PostgreSQL cluster.
  It checks nine scenarios, actual receipts/final state, new-owner isolation,
  pending dispatch-race preservation and the unsafe control release described
  above. SDK calls remain mocked; SQL replay is separate, not live transport E2E.
- Existing lifecycle regressions remain unchanged; foundation/production typing,
  CI and preview bind the final source. These adapters are ordinary request-time
  functions, not new journaled workflows; no additional workflow compiler fixture
  or claims of provider cancellation are needed for their source contract.

```sh
CHAT_LIFECYCLE_TRACE_OUTPUT=/private/tmp/lifecycle-trace.json \
  pnpm exec vitest run lib/chat/fence/lifecycle lib/chat/__tests__/fencedLifecycleContracts.test.ts
CHAT_LIFECYCLE_SQL_OUTPUT=/private/tmp/lifecycle-sql-results.json \
  python3 scripts/chat-fence-lifecycle-fixture/test-sql.py \
  /path/to/database /private/tmp/lifecycle-trace.json
```

Status: disabled adapters qualified for source review; pending no-start closure is
blocked on the separately owned atomic SQL proposal. Next action: root reviews
and merges source if accepted. No enrollment, production wiring, real cancellation
or activation follows from these tests.
