# Unwired finite admission candidate

`waitForPackAdmission` is an unregistered composition helper. Nothing in production
calls it, and it does not call the foundation factory. The 30-second cutoff and
scheduled poll interval of at most one second are engineering qualification values,
not a selected production timeout or service-level guarantee.

`startPackAdmissionStep` journals the executing Workflow ID and a server clock once.
`pollPackAdmission` derives one absolute deadline from that saved result. Every poll
invokes `readPackAdmissionStep` separately, producing a distinct durable step result.
Completed reads replay from their own journal entries; the next poll is a new read,
not reuse of a cached initial snapshot. Absolute durable sleeps stop at the earlier
of the next poll time, original hold expiry and admission deadline. Once the start-step result is durably completed, restart cannot reset that saved
clock or extend its deadline. A crash before completion can execute the clock step
again; the fixture does not qualify that pre-journal window.

The read step calls only the existing owner/org-scoped read RPC. The loop tolerates
only an absent saved workflow ID on the same running, authorized job with a valid
future hold. It requires the current step's Workflow ID to remain the original ID.
A different saved ID, empty ID, wrong owner/job, non-running status, expired/invalid
hold or read/access failure returns `needs-reconciliation` without another poll.
Admission observed at or after the deadline returns reconciliation even if the ID
matches. A backward or invalid clock is also rejected. No step automatically retries.

Results retain the original job/run IDs, absolute deadline and first authorized,
valid hold expiry. If the first read fails before an expiry is known, that field is
null; no expiry is invented. A later extension cannot extend this candidate's original
hold boundary. No `run`, `approve`, provider, context write, settlement or dispatch
operation is available through the coordinator's ports. The existing database read
may reconcile an already-expired hold under its existing policy; this candidate does
not add a hold release, renewal or funding action.

The cutoff governs admission eligibility, not maximum wall-clock response time.
An in-flight RPC, stalled infrastructure or delayed Workflow delivery can return
later; cancellation and hosted scheduling have not been qualified. The next fresh
observation still cannot admit after the original cutoff. Reconciliation is an
explicit result, not permission to start another run or retry paid work.

## Qualification

Unit tests exercise exact deadline and hold boundaries, immediate/delayed/missing ID,
wrong identity/status, read failure and clock anomalies. Adapter tests use the actual
RPC wrapper with a mocked server client to verify exact account/org/job forwarding,
read-only calls and zero retry settings.

The separate `scripts/pack-admission-workflow-fixture` compiles the actual composition,
coordinator and durable steps, replacing only the read RPC with a typed synthetic
boundary. It uses the unchanged shared local-world, network-denial, polling and
strict-type helpers. Scenarios cover immediate admission, delayed persistence across
process restart, deadline across restart, different ID, read/access failure and
expired hold, and expiry while waiting. The fixture retains the decoded original journaled start-clock result
and checks the exact deadline, distinct read-step correlations, one original start,
no other step/effect, unchanged hold and exact scheduled wake times against every
decoded read result. Pre-crash trace entries must remain an unchanged prefix; each
effect carries its durable step ID and must occur exactly once across restart and
terminal replay. Fresh polls already due at restart are allowed distinct IDs.
The delayed case simulates persistence of the original dispatch ID outside the
workflow; it does not perform self-admission or start a second workflow.

On an outcome assertion failure, `PACK_ADMISSION_ASSERTION_FAILURE` in the CI log
retains the synthetic read trace, decoded observations and journal event IDs,
correlations, timestamps and wait lifecycle before temporary files are removed.
This distinguishes repeated storage events from distinct logical waits. No events
or wake timestamps are deduplicated; extra, early and late waits still fail.

This is local compiled replay with synthetic database reads. It does not establish
SQL atomicity, authenticated hosting, provider execution, production timeout policy,
or owner-facing continuation. The existing unconditional `run` write, reused preparation
write and point-in-time authorization still do not fence cross-run takeover. Production
wiring and those authority/continuation contracts remain separate prerequisites.
