# Task-run access

`readTaskRunForAccount({ runId, accountId })` retrieves a provider run and applies
`canReadTaskRun` before returning it. The account comes from each transport's
existing authentication and override checks. Missing, foreign, contradictory, or
unattributed ownership returns `null`; provider and ownership-lookup failures
propagate to the transport's existing error handler.

REST single-run reads, API-key MCP, and full delegated OAuth use this operation.
REST list mode retains its existing account-tag filter through `fetchTriggerRuns`.
ESLint prevents raw `retrieveTaskRun` imports in API routes, task handlers, and MCP transports.
The runtime ownership tests remain necessary: a valid import does not prove that
the operation still enforces its policy.

Two internal callers retain their own semantics:

- `linkTriggerRunToWorkflow` checks the worker's account tag before writing a
  workflow link. It is a metadata mutation, not a run-read response.
- `getTaskTriggerInfo` enriches already-selected tasks using their stored
  schedule IDs. It reads the latest run's upcoming schedule, not an arbitrary
  caller-supplied run ID. Its callers remain responsible for selecting accessible
  task rows.

## Verify the entry points

| Client and entry point | Account and action | Visible result |
| --- | --- | --- |
| HTTP client, `GET /api/tasks/runs?runId=…`, API key or first-party bearer | Read an owned run; repeat with a controlled foreign run | Owned: 200 with the unchanged `status`/`runs` envelope. Foreign: 404 and exactly `{"status":"error","error":"Task run not found"}`. |
| API-key MCP, `get_task_run_status` | Read the same two runs | Owned: the existing full run JSON. Foreign: `{"success":false,"message":"Task run not found"}` in the text result. |
| Full delegated OAuth MCP, `get_task_run_status` | Connected personal account with `mcp:tools`; read the same two runs | Owned: only ID, status, task identifier, and timestamps. Foreign: the existing generic permission-denied tool error, without run details. |

REST account overrides still require the existing access check. Delegated OAuth
rejects account overrides and rechecks scope, account, client, and grant before
provider retrieval. Narrow `mcp:read` consent does not grant this full-catalog tool.

Run the deterministic checks from the API root:

```sh
pnpm exec vitest run lib/tasks/__tests__/readTaskRunForAccount.test.ts lib/tasks/__tests__/canReadTaskRun.test.ts lib/tasks/__tests__/getTaskRunHandler.test.ts lib/tasks/__tests__/taskRunRoute.test.ts lib/tasks/__tests__/validateGetTaskRunQuery.test.ts lib/tasks/__tests__/taskRunImportBoundary.test.ts lib/mcp/tools/tasks/__tests__/registerGetTaskRunStatusTool.test.ts lib/mcp/oauth/__tests__/taskRunAccess.test.ts lib/trigger/__tests__/retrieveTaskRun.test.ts
pnpm test:mcp-oauth
pnpm typecheck:mcp-oauth
pnpm lint:check
```

The task-specific tests invoke the exported Next `GET`, the registered API-key
tool, and the full OAuth registration/adapter in process. Credential verification,
provider responses, scheduled-task storage, and delegated preparation are fixtures.
They exercise real ownership policy and response formatting, but do not prove
network routing, live credentials, a named agent client, or deployed behavior.

Before describing a release as verified, repeat the table against an authorized
test deployment using existing owned and controlled foreign run IDs. Save the
revision, client, intended account role, status, and exact redacted result. Do not
start a paid job merely to obtain a run ID.

For a regression check, temporarily make `readTaskRunForAccount` await
`canReadTaskRun` but ignore its result. The foreign-run tests must fail for all
three transports while the import-boundary tests and lint still pass. Restore
the ownership guard and rerun the focused checks before committing.
