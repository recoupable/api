# Cleanup after task schedule creation failure

Bounded successor to the cleanup slice of original API #291, head
`845d0e79c524c4e50d12993994667c3d4502e849`. Its separate cron-validation slice is already
released through API #1100; that parser is not changed here.

## Customer effect

Task creation first inserts a scheduled_actions row, then creates its Trigger
schedule and saves the returned schedule ID. If schedule creation rejects or
returns an empty/missing usable ID, the API now attempts to delete only the row
just inserted by this call. It rethrows the original scheduling failure. A cleanup
delete failure is logged without masking that failure. Successful creation,
returned task data, time zone forwarding and schedule identity are unchanged.

The original proposal wrapped provider errors with a new prefix. This successor
preserves current error identity/text and existing transport error envelopes.
REST and MCP already share createTask, so no separate transport logic is added.

## Limits

This is best-effort cleanup, not a transaction across Supabase and Trigger. A
network rejection or missing response ID does not prove the remote provider
created no schedule; this change does not find or remove an unknown remote
schedule. If cleanup itself fails, the local row can remain. Errors after a
schedule ID is returned, including failure to save that association, retain
existing behavior and do not trigger this new delete. Historical partial tasks,
reconciliation/retry design and broader lifecycle recovery are outside scope.

No new task/job, worker change, dependency, schema migration, account-access rule,
plan limit, cadence, time zone policy, billing or model behavior is introduced.
The only new runtime effect is a scoped database delete attempt after the
existing creation failure branch. No scheduled provider job or customer operation
is performed during verification.

## Evidence

Regression tests exercise the real createTask function with plan/database/
scheduler leaves mocked. They cover successful creation, provider Error and
non-Error rejections, missing schedule ID, cleanup failure, insert failure,
missing inserted ID, plan rejection and an association-write failure after
provider success. Existing isolated suites mock the newly imported database
helper as well. These tests prove call ordering/bounds and error preservation,
not actual database deletion, a provider's network outcome, real task execution,
production billing or hosted customer recovery. Merge, normal deployment and a
live outcome must be recorded separately.
