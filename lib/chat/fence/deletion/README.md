# Original-intent trailing deletion — internal, unwired

2026-10-25. API base `1920d3011bbdac3d5e94b5a12216d25308634598`; existing Database122 SQL `7914f063729db04960149647d9ee19c8f857c417` remains draft/unapplied. Only this delete adapter and its focused fixtures/docs are added. No public route, MCP tool, enrollment flag, lifecycle/workflow code or shared command schema changes.

`createFencedTrailingDelete(original, executeChatFenceCommand)` captures and freezes the already-authorized chat/effective account, original expected epoch, durable deletion request UUID and anchor. The caller must authenticate and authorize ownership/overrides before constructing it; parsing those fields does not grant access. This is an internal intent, not a new public body schema. No ID/epoch is generated or inferred.

Each explicit `.delete()` submits exactly one existing `delete` command. There are no state reads, automatic retries, fresh-epoch adoption, direct chat_messages fallback, provider cancellation, admission or credential calls. A transport exception or resolved failure propagates as a sanitized FencedPersistenceError. SQLSTATE40001 is a conflict, not permission to renew authority;40P01 preserves the existing same-command retry hint but never triggers an automatic retry. Explicit recovery must retain the original full intent and rerun current access checks outside this unwired helper. No retry policy is enabled here.

The adapter requires a correctly shaped acknowledgement with the original request ID and resulting epoch equal to original expectedEpoch+1. It revalidates even injected executor successes and rejects wrong action, missing/malformed acknowledgement and raw transport errors. It returns the actual `{request_id,epoch,deleted}` receipt, not an invented success boolean or new owner. The captured command remains unchanged after failures or input mutation.

## Receipt authority and bounded contract

SQL stores the deletion receipt under chat/request, rejects changed expected epoch or anchor under that key, and checks the original receipt before current phase/epoch. Therefore an exact retry after a newer admission can return the original receipt without deleting new history. The adapter does not require current-idle state on receipt replay and never rereads/replaces its original epoch.

The receipt does **not** echo chat/account/anchor or cryptographically attest them. Their binding comes from the authenticated, scoped SQL RPC invocation and SQL's stored request comparison. The adapter must not attach local chat/anchor fields and present them as independent DB evidence. If a future untrusted receipt transport needs self-contained cross-scope attestation, that is a separate concrete SQL contract question; no fields or guarantees are invented here.

For a new deletion, accepted SQL requires idle state, matching expected epoch and null legacy slot under lock, then atomically tombstones and deletes the inclusive `(created_at,id)` suffix and records the epoch-bumped receipt. This source adapter alone does not prove all writers are fenced or that a deployed chat is enrolled/drained. It does not stop a workflow or prove quiescence. No activation follows from passing fixtures.

## Legacy wire comparison

The current public handler still validates its existing query/ownership/slot read, executes the direct Supabase deletion, and returns `{status:"success",chat_id,from_message_id}` when that statement returns true. Its boolean may represent zero rows and does not fence outstanding writers. Existing handler/validator/delete tests are run unchanged to confirm that wire behavior; they do not establish the new fencing guarantee. This adapter returns a different internal SQL receipt and is not silently wired into that handler. The published bounded/quiescent contract remains unchanged.

## Actual command/receipt qualification

New tests mock only the RPC transport boundary and exercise the real executeChatFenceCommand/parser plus this adapter. They check original identity after caller mutation, explicit identical retry after ambiguous response, controlled SQL errors and malformed acknowledgements. The fixture generator captures actual adapter RPC argument objects and API-generated admission setup into `scripts/chat-fence-delete/vectors.json`.

`test-sql-delete.py` loads the existing SQL and disposable setup/cleanup harness directly from git at7914f063; it does not copy SQL or rerun the unchanged Context proposal suite. A fresh socket-only PostgreSQL cluster executes captured commands as service_role. It covers pending/running refusal, stale epoch, foreign anchor/account denial, exact tied-microsecond inclusive boundary, rollback, committed-response-loss simulation, duplicate receipt before and after newer pending/running admission, changed same-key input denial, new-message survival, tombstone reuse rejection and cross-chat preservation. Original SQL outputs/errors are then fed through the actual API RPC boundary and adapter. This is a local command/receipt roundtrip, not an HTTP/PostgREST, provider, live auth or deployed test. The rollback vector is an explicit harness transaction; it is not a claim that production acknowledgement precedes commit.

Reproduce from the API worktree (the database path must contain pinned7914f063):

```sh
CHAT_FENCE_WRITE_DELETE_VECTORS=1 pnpm exec vitest run lib/chat/fence/deletion/__tests__/sqlDeleteVectors.test.ts
CHAT_FENCE_DELETE_SQL_RESULT=/tmp/delete-sql.json python3 scripts/chat-fence-delete/test-sql-delete.py /path/to/database
CHAT_FENCE_DELETE_SQL_RESULT=/tmp/delete-sql.json pnpm exec vitest run lib/chat/fence/deletion
pnpm exec tsc --noEmit --project tsconfig.chat-fence.json
pnpm exec tsc --noEmit --project tsconfig.chat-fence.json --strict false
```

Ordinary CI validates the deterministic command vectors and mocked adapter tests; the actual disposable SQL result replay runs when its output environment variable is explicitly supplied. The sealed task evidence records that local SQL run. No new cross-repository CI credential or SQL application is introduced.

## Next dependency

Root owns source acceptance/merge and further integration ordering with UI1163. All existing resource/credential/recovery, Stop/edit, backfill, ancillary-effect and enrollment/drain gates remain. No schema change was required for this trusted internal RPC boundary. Database122 and all prior sealed packets remain unchanged; no production routing, cancellation, hosted account/provider operation or activation occurred.
