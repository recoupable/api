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

Release pairing rechecked October 25, 2026: [App #2341](https://github.com/recoupable/app/pull/2341) reviewed head `f39c696e3bc1dc1aa2cb6baecb12b1ca04a10cd8` merged as `08117a1c2f0b746a1eda4304eb865741958f8a31`. Its [final coordinator acceptance](https://github.com/recoupable/app/pull/2341#issuecomment-6386223876) records corrected bootstrap/recovery behavior and controlled Chrome/Vite acceptance with synthetic services. The old provisional `33318d1` reference is no longer the release pairing.

Current App main `150e5cd14999d5a84b5029b00776eb012229f9cf` differs from that merge only in the task-card missing-schedule fix and its test; chat lifecycle source and dependency files are unchanged. GitHub deployment `7305416477` reports `Production – app`, success at `2026-10-24T22:32:40Z` for that exact commit. API #1126 and #1127 are already merged; API main `c0cdf456263aab97118f7a297976c7ddfed0025c` has successful Production deployment `7299529642` at `2026-10-24T13:54:30Z`.

The deployed App source adds the exact opt-in to installed-SDK POST and cursor-based GET, retains rejected drafts/attachments for manual retry, and treats failed or unconfirmed Stop as retryable without locally acknowledging cancellation. Fresh network-denied verification passed 308 App tests across 24 files, including 127 actual-provider lifecycle cases, plus 12 independent installed-SDK admission/cleanup probes. API runtime candidate `f7f856fdcb3019948c03f2148ada8f03f42188d1` passed 147 focused tests across 18 files with strict unhandled-rejection handling and network denial, including real SDK readers through both canonical route exports. Independent runtime review found no actionable introduced defects.

This resolves the stale App-source prerequisite and verifies deployment identity, not authenticated production behavior. Prior browser acceptance used controlled development rendering, not a production Next build or real providers. Hosted send/reconnect/Stop behavior, device/screen-reader acceptance and real customer workflows remain unverified; do not describe the release as end-to-end production accepted. Explicit merge approval is still required.

Required remaining release order: this API #1128 admission/opt-in lifecycle successor; then [API #1129](https://github.com/recoupable/api/pull/1129) contract companion; then [Marketing #230](https://github.com/recoupable/marketing/pull/230) maintained documentation; then the generated retained Docs publication pinned to the actual Marketing merge. API #1071 and Marketing #209 are historical predecessors, not additional releases. Qualify exact resulting composition and replace preview pins with actual merge identities at each step. Do not fabricate merge references or publish the retained Docs copy early. The source contains no new credentials, permissions, schemas, provider/model jobs or manual deployment. Review/source and mocked-runtime checks do not establish live customer acceptance.

## Verification

The retained baseline red runs reproduce silent POST acceptance, pending Stop false success and opted-in disconnect cancellation. Handler integration tests use the real response watcher and mocked workflow/database leaves; both POST and GET exercise absent/unknown/exact/repeated opt-ins, cursor headers, reader cleanup and cancellation counts. A delayed start test confirms pending Stop fails truthfully, a subsequent Stop waits for terminal status, and a newer slot survives an older Stop completion. Existing terminal synthesis, shared auth/ownership, failed-cancel, timeout and CAS tests remain controls.
