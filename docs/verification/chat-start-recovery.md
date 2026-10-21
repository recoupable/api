# Chat start/reconnect successor verification

This is the current-main successor slice of retired API PR596 (`32b38fb7a8b58000a1a8a50185366d36e80efb3a`), tracked by Mono358. The old branch is preserved; this does not retarget or close it, upgrade AI SDK, or change App1771. Source baseline: API `faac8e60abf42c1ab7eb44f6accc994a2b6c61fb`.

## Acceptance map

| Original behavior | Current successor and decision | Focused evidence |
| --- | --- | --- |
| A new POST during a live run must not silently resume and discard the submitted message | Gap repaired at canonical `/api/chat`: the handler uses a start gate; return409 with the GET recovery path; no workflow start, message persistence or stream reader | `chatStartRecovery.test.ts`, running and pending runs; `gateChatStreamStart.test.ts` |
| Indeterminate run status or a failed/raced stale-slot clear must be retryable | Gap repaired:503 with retry guidance, preserving the slot and preventing a duplicate start | Real reconciliation path in `chatStartRecovery.test.ts`; existing reconciliation cases |
| A terminal stale slot is cleared so the POST can start a new turn | Existing behavior retained | Real-path test verifies clear → claim → promote and exactly one new workflow/message persistence |
| Concurrent POSTs cannot start duplicate paid runs | Existing placeholder claim before start is retained | Existing `handleChatWorkflowStream.test.ts` claim/promotion/lost-slot cases |
| GET resumes a live response and supplies `x-workflow-run-id` | Replaced by merged API809 (`88ab64041da00215552d88bf16e6bcf8e534a286`); preserve its current `startIndex` and tail-index support | Existing `handleResumeChatStream.test.ts` |
| No live run or a terminal run returns204 | Intentionally superseded by commit `9d2158533596a5e6ea9089fc08bea3558473d4cd`: return a200 stream containing `finish`, so the cross-origin transport terminates rather than looping on an empty204 | Existing GET tests and `createNothingToResumeResponse.ts`; do not restore old204 |
| Indeterminate GET probe returns204 without clearing the slot | Intentionally superseded by current502: a failed lookup is not proof there is nothing to resume | Existing GET failed-status test; no slot clear |
| GET authentication, UUID and ownership checks; API-key and bearer support | Current shared `validateChatOwnership` retained, including auth-approved account override; failed chat lookup now500 rather than404 | Existing ownership/GET suites plus `chatReadFailure.test.ts`; these mock authentication and do not claim live token proof |
| Disconnect releases the reader without cancelling the durable run; abort/read races close cleanly | **Unresolved original requirement.** Current watcher calls `getRun(runId).cancel()` on consumer cancel and surfaces source read errors. This PR preserves that behavior; it does not implement the original durable-disconnect or abort/late404 changes | Existing watcher cancel test explicitly expects one run cancellation. Tests for terminal tool cleanup do not establish durable disconnect or abort recovery |
| Database lookup failure must remain distinguishable from a missing chat | Gap repaired at shared `selectChats`: null on failure, [] on successful empty result. Every production/script caller handles null | Adapter test; POST/ownership/session-validator/read-list failure tests; unchanged missing-row tests |
| Failed idempotency lookup must not permit a chat insert | Current-main caller migrated to the explicit failure contract;500 before insert | `chatReadFailure.test.ts` |
| Chat-list failure must not look like a successful empty list | Null propagated by summaries and converted to500 by the list handler | Caller regression checks failure and successful empty outcomes |
| Failed active-stream lookup must not permit sandbox hibernation | Caller defers hibernation when absence of a stream cannot be established | Caller regression for `hasActiveStreamForSession` |
| Existing migration script must not treat lookup failure as permission to insert | Script caller stops on null; no migration is executed by verification | Mocked `migrateRoom.test.ts` failure case |

Only `app/api/chat/route.ts` exports the canonical POST in the inspected baseline and candidate trees. There is no `app/api/chat/workflow/route.ts`; older route/handler comments mentioning that alias are stale source comments, not route-availability evidence. This candidate adds no legacy route or alias. The previously claimed alias coverage was unsupported and is corrected here.

## Remaining original reconnect work

Do not close API596 or claim its full reconnect outcome from this PR. The original branch explicitly removed workflow cancellation on consumer disconnect and added clean handling for abort/read races. Current main still cancels the run on disconnect, and that behavior is covered by its existing watcher test. The prior version of this map incorrectly described that test as proving the opposite; independent review caught the discrepancy.

A watcher repair needs API/UI coordination: confirm that the client Stop action explicitly calls the authenticated `/api/chat/{chatId}/stop` endpoint before making ordinary stream disconnect preserve work. At inspected App source `e2433581ecbe290987f3260e254004e373e11491`, `useVercelChat` exports the SDK's `stop`; a separate server-stop call was not established by the source search. This is a dependency to resolve, not proof that no such call can exist. Without that distinction, changing the watcher could let a Stop action leave work running. API owns watcher and explicit-stop semantics; UI owns its stop/reconnect wiring and rejected-message recovery. Current server stop tests establish explicit API cancellation, not installed-client behavior.

## Production impact and caller expectations

POST is a submission, GET is reconnection. On409 the client should reconnect to the current response, retain the unsent message, and submit it after that response ends. On503 it should retain the message and retry later. The server does not claim to have accepted either rejected submission. Callers that used POST as an implicit resume request should use GET `/api/chat/{chatId}/stream`; a canonical client using the GET transport keeps its reconnect behavior.

Chat-read outages now produce500 at affected HTTP boundaries instead of false404 or successful empty lists. During an outage, sandbox hibernation is deferred until a later successful read. All ownership and authentication checks remain in place. No provider, database migration, billing, package dependency or deployment configuration changes are included.

## Synthetic verification

Run the focused chat start/gate/reconcile/resume/watcher/ownership suites, `lib/supabase/chats/__tests__/selectChats.test.ts`, all `lib/sessions/chats/__tests__`, and `scripts/backfill/__tests__` with Vitest. All external workflow, database, sandbox and model dependencies in the new cases are mocked. Tests do not create customer runs or execute a backfill.

Before correction, the new probes produce seven failures in the initial start/adapter set and nine failures in the shared-reader caller set. The unchanged baseline had50 passing focused chat cases. Repository-wide TypeScript diagnostics must be compared with the exact baseline; unrelated failures are not a passing global typecheck. Independent review, owning main-target PR approval, merge and automatic deployment verification remain separate gates. No live customer outcome is established by these tests. Remaining disconnect/abort acceptance and UI rejected-message/Stop behavior stay open independently of this start/read-error slice.
