# Shared chat-read failure repair

This current-main candidate separates the proven database-read repair from held API1070 (`2d0ad56b4df596ed9e8c387d784cfc9eb9d7180d`). It does not resolve that PR's overlapping-submission compatibility gate, original API596 disconnect/abort requirements, or App1771. The original1070 branch remains intact.

`selectChats` currently returns an empty array on database failure. Callers cannot distinguish an unavailable read from a successful empty lookup: some report404 or an empty list, and creation/backfill/hibernation can proceed on a false absence assumption. The repair returns null on failure and preserves [] on a successful empty result. Every production and script caller handles null explicitly.

- HTTP readers and idempotent creation return500 on failed chat lookup. Genuine missing/empty outcomes retain their current behavior. Authentication and ownership validation remain in place.
- Chat summaries propagate failure to the list handler rather than returning a successful empty list.
- The sandbox active-stream check defers hibernation when stream absence cannot be established.
- The migration script stops after a failed chat lookup instead of inserting a chat or migrating messages. Verification never executes a real migration.

## Separation boundary

Baseline API source: `faac8e60abf42c1ab7eb44f6accc994a2b6c61fb`. `handleChatWorkflowStream` gains only the null-read guard; its remaining bytes match the baseline. `maybeResumeChatStream`, `reconcileExistingActiveStream`, GET resume handler/route, stream watcher and explicit-stop handler remain byte-identical to baseline. No new409/503 start gate or queue is included. Canonical `/api/chat` remains wired to the original handler. No route is added; the baseline tree does not contain an `/api/chat/workflow` route despite older source comments describing one.

The existing POST live-run resume behavior is intentionally retained, including its unaccepted-new-message limitation under1070. Two synthetic compatibility tests exercise the real handler → original helper → reconciliation path for running/pending runs and assert the original200 SSE/run-id result. Existing fresh-start/CAS, missing-row, auth, GET and watcher tests remain part of focused validation. Retaining existing behavior here is not a claim that it meets1070's desired future UX.

All external workflow, database, sandbox and model leaves in new tests are mocked. The standalone failure probes first fail12cases on untouched main. Source byte/handler-diff assertions independently verify separation. Independent review and coordinator approval remain required for this candidate. No customer requests, provider jobs, database changes, backfill, manual deployment or client installation occur during verification.

API1071 inherits the held1070 branch; its combined409/503 documentation cannot be merged or relabeled as this separate repair. Its owner must select any required DB-only documentation delta separately after runtime acceptance. No successor disposition or full reconnect closure is implied.
