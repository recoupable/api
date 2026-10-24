# Pending chat Stop safety prerequisite

When `POST /api/chat/{chatId}/stop` finds a `pending-*` reservation, the workflow start has not returned a run ID. Previously this branch cleared the reservation and returned `stopped: true` while the delayed start could still complete. It now returns the existing error envelope with HTTP 503 and “Workflow is still starting; retry Stop shortly”. The reservation is unchanged. Repeated Stop requests remain retryable; no message submission is replayed.

Real run IDs keep the existing cancel-and-wait behavior, including 502 for failed cancellation, 504 for terminal-wait timeout, and compare-and-set release that cannot clear a newer run's slot. Authentication and chat ownership are unchanged. No active run remains an idempotent success with `stopped: false`.

This is the first release prerequisite under Mono358 / API596 / API1070. It contains no admission, watcher, opt-in, UI, schema, credential or permission change. Release the App message-retention/server-Stop companion next, then the exact `streamLifecycle=explicit-stop-v1` API lifecycle/admission companion, followed by the API1071/Docs209 contract updates after final source qualification. API1070's chat-read adapter fix is already on main and is not duplicated here.

Mocked checks reproduce the false pending success before correction and cover repeated pending Stop, real cancellation, terminal wait, validation, no-active-run and CAS behavior. This is synthetic source evidence, not a live job cancellation or customer-flow claim.
