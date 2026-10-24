# Chat admission and explicit Stop lifecycle

Successor for the still-open runtime/client portion of Mono358 / API596 / API1070. The chat-read adapter repair from API1070 is already on main; it is not reintroduced. The separate API1126 pending-Stop guard remains required before either dependent release.

## Submission and recovery

POST `/api/chat` accepts a new turn only with an empty or safely cleared terminal slot. A running/pending workflow returns 409 and points to GET `/api/chat/{chatId}/stream`; it never returns the old response as if it accepted the submitted message. A pending reservation, uncertain status, unknown status or failed/raced stale-slot clear returns retryable 503 without opening a reader or starting work. Callers retain the rejected text and attachments for explicit manual retry. No automatic queue or POST replay is added.

GET reconnection retains ownership/authentication, absolute startIndex parsing, tail-index headers, run-id header, finish-only 200 when there is nothing left, and 502 on an unreadable run. Unknown404/errors are not converted to successful completion.

## Versioned disconnect policy

Both initial POST and GET use the exact opt-in query `streamLifecycle=explicit-stop-v1`. Exactly one query value is required. For that value only, cancelling the response reader releases the subscription and stops polling without cancelling the workflow. Terminal tool-output synthesis remains unchanged. Missing, unknown or repeated lifecycle values keep legacy run cancellation on disconnect. Older tabs therefore retain their previous behavior.

A deliberate Stop still calls authenticated POST `/api/chat/{chatId}/stop`. Pending reservations return retryable 503 and remain held; no false stopped:true. Real runs are cancelled and observed terminal before success. Failed cancellation 502 and terminal-wait timeout 504 retain the slot. Compare-and-set cleanup cannot erase a newer run. No-active-run Stop stays idempotent with stopped:false.

The application reader boundary also owns the installed Workflow SDK's subscription-completion promises. It forwards a unique subscription cancellation reason and treats only that exact reason as expected. Unexpected completion/read failures remain visible and release the subscription; no global rejection handler or dependency change is used. Both POST and GET use this boundary, preserving GET's tail-index helper. Strict Node tests use the real SDK with a synthetic World, while the unchanged pure-SDK default-reader cancellation failure remains a separate dependency control.

## Compatibility and release order

Provisional source compatibility was inspected at App feature commit `33318d1804c4408dd0b2831cd6a9116f9675f43f` (tree `85c9ee26c1e3cc3f1a3d52a00d2780c97137d948`); that commit is historical and unaccepted as the release pairing. The UI owner is correcting a stale-handler regression and must return a corrected exact revision before release. The inspected source adds the opt-in to both installed-SDK POST and cursor-based GET, retains rejected drafts/attachments for manual retry, and treats failed or unconfirmed Stop as retryable without locally acknowledging cancellation. This is a source compatibility reference, not proof that the App is deployed. API release is blocked until the corrected App exact commit receives independent native acceptance and production release verification. Record that exact App identity before API release acceptance.

Required release order: API1126 pending-Stop prerequisite; then the App retained-submission/server-Stop companion; then this API admission/opt-in lifecycle successor; then the API1071/Marketing209 exact contract companions. The source contains no new credentials, permissions, schemas, provider/model jobs or manual deployment. Review/source and mocked-runtime checks do not establish live customer acceptance.

## Verification

The retained baseline red runs reproduce silent POST acceptance, pending Stop false success and opted-in disconnect cancellation. Handler integration tests use the real response watcher and mocked workflow/database leaves; both POST and GET exercise absent/unknown/exact/repeated opt-ins, cursor headers, reader cleanup and cancellation counts. A delayed start test confirms pending Stop fails truthfully, a subsequent Stop waits for terminal status, and a newer slot survives an older Stop completion. Existing terminal synthesis, shared auth/ownership, failed-cancel, timeout and CAS tests remain controls.
