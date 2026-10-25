# Disabled phase-aware Stop/resume adapters — 2026-10-25

Base API: `544493e110b2813bd85c68f92ef68628ccee3027` (accepted internal workflow
branch). Contract/harness: exact Context SQL
`7914f063729db04960149647d9ee19c8f857c417`, tree
`8bfb22ce61495c706e1c9d6f4c635615aab2123d`.

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
| Captured pending reservation | 200 only on atomic closed:true; otherwise503 | 503 | Stop issues only close_unattempted; resume issues no SQL; neither calls SDK |
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

## Atomic pending closure and separate external proof

Pending Stop sends exactly `close_unattempted {owner,epoch}` using its frozen
original target. The strict receipt is `{closed:boolean}`. Only acknowledged
`closed:true` proves this call closed an unattempted pending reservation. SQL
serializes this check with `claim_dispatch`: close wins and claim is denied, or
claim wins and close returns false while preserving the original claim.

A false receipt is information only, including a retry after successful closure.
False, malformed receipts, errors and transport ambiguity return the existing
pending503 body. They grant no fallback cancellation, generic release, dispatch,
retry, credential cleanup or newer-owner adoption. Pending resume stays503 with
zero SQL/SDK effects. A prior `never_attempted` read is never permission.

Under SQL7914, pending `release(reason:confirmed_no_start)` additionally requires
a recorded attempt. That assertion still requires independently authoritative
external no-start evidence from the service; SQL does not verify provider proof.
Stop never emits it or derives proof from missing status, null run, timeout or
prior dispatch history. The prior SQL61d8 unsafe-control evidence remains sealed
historical evidence; it is not the current adapter or SQL qualification.

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
   fenced target through `stopFencedChatWorkflow`. Pending uses the atomic original-token close; only closed:true returns200.
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
6. Use only the accepted exact atomic close interface for unattempted pending
   work. Claimed ambiguity still requires separate authoritative reconciliation;
   this PR supplies no external no-start proof or credential recovery path.
7. Separately qualify Stop/edit/backfill and live client/provider behavior before
   production activation. These source adapters do not implement those workflows
   or establish credential cleanup/recovery safety.

## Evidence and reproduction

- Unit/trace tests cover captured authority, invalid reservation IDs,
  pending, stale/closed state, cancellation/status/release errors, input mutation,
  status/owner races, real SSE reader cancellation, and actual-handler contracts.
- `sqlLifecycleTrace.test.ts` emits fourteen actual adapter command traces with
  synthetic SDK cancellation/status evidence and API-generated admission bytes.
- `scripts/chat-fence-lifecycle-fixture/test-sql.py` loads unchanged SQL/harness
  through pinned `git show`, using a disposable socket-only PostgreSQL cluster.
  It checks fourteen scenarios, actual receipts/final state, new-owner isolation,
  both real two-connection claim/close lock races, immutable snapshots, retry and
  committed-response loss. Actual SQL close receipts round-trip through the adapter.
  SDK calls remain mocked; SQL replay is separate, not live transport E2E.
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

Status: disabled adapters target the accepted draft atomic SQL interface, which
remains unapplied. Claimed ambiguity remains preserved. Next action: root reviews
and merges source if accepted. No enrollment, production wiring, real cancellation
or activation follows from these tests.
