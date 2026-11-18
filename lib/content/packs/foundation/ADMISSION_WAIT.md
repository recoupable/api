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
boundary. It uses a fixture-local adapter around the installed SDK, plus unchanged shared
failure-delivery, polling and strict-type helpers. Its local network guard extends
the unchanged shared guard to reject WebSocket construction and HTTP/2 connections. Scenarios cover immediate admission, delayed persistence across
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
The resumed worker also saves raw events, delivery counts and the pre-crash trace
before decoding or assertions, then adds decoded observations before validation.
On child failure, the parent emits `PACK_ADMISSION_SAVED_FAILURE` before cleanup;
missing capture is reported explicitly. This distinguishes repeated storage events
from distinct logical waits. No events
or wake timestamps are deduplicated; extra, early and late waits still fail.

This is local compiled replay with synthetic database reads. It does not establish
SQL atomicity, authenticated hosting, provider execution, production timeout policy,
or owner-facing continuation. The existing unconditional `run` write, reused preparation
write and point-in-time authorization still do not fence cross-run takeover. Production
wiring and those authority/continuation contracts remain separate prerequisites.


## Local SDK concurrency boundary and fixture recovery

The local fixture resumes its saved run through `world.start()` recovery exactly
once. It does not also enqueue that active run explicitly. The separate explicit
terminal replay remains mandatory. A passive observer records SDK queue message
IDs, attempts, per-handler AsyncLocalStorage context, event create requests/results,
list cursors and returned event IDs. The queue observer is installed before startup
through an isolated loader with an exact SDK source hash; installed files are not
changed. It returns original SDK promises/results and adds no locks, retries or
serialization. JSONL persistence is asynchronous and capped at20,000 entries/2MiB. Successful
qualification closes the SDK, drains late log writes, checks a fresh snapshot for
dropped entries/persistence errors, then writes the receipt. A last-append failure
cannot produce a success receipt; an earlier operation error remains primary.
The start phase likewise drains and checks its snapshot before writing the
pre-crash trace or ready receipt, without closing the SDK before intentional SIGKILL.
The drain returns a frozen snapshot only after all writes queued during the drain
have settled; later observations belong to a later checkpoint.

`probeRecoveryEnqueues.mjs` uses identical saved-run bytes and the actual SDK queue
with a bounded synthetic receiver. Startup-only and explicit-only each produce one
message; combining them produces two distinct messages. This probes enqueue
provenance, not generated workflow replay. `probeWaitCreation.mjs` separately gates
the actual installed filesystem writer after both wait-path absence checks, through
a byte-verified isolated loader seam. Serial duplicate creation conflicts; controlled
overlap can store distinct event IDs for the same correlation, including conflicting
wake times. The write logic and installed files remain unchanged. These deterministic
controls reproduce an SDK mechanism; they cannot retrospectively classify the earlier
CI failure whose log lacked event IDs. Removing a redundant fixture enqueue does not
establish general SDK concurrency fencing or production safety.

Run either bounded probe with `node --import
./scripts/pack-admission-workflow-fixture/installAdmissionObserver.mjs` followed by
its script path. Receipts distinguish scope, actual requests, returned IDs, raw
records, the seam and source hashes. The exact scheduled-wake and read-effect
oracles remain strict; repeated records are retained, and contradictory payloads
for one event ID fail. Distinct waits at the same timestamp are not deduplicated.

Failure capture now also covers parent timeout, signal and early child exit. The
parent requests a bounded live snapshot, drains incremental operation records and
reads raw journal/wait files before owned-child cleanup. It preserves the original
error and explicitly marks unavailable or truncated evidence. Snapshots from these
sources are not an atomic view of a live process. Tests force these paths and verify
retained evidence and child cleanup; they do not claim a hung event loop can answer
an IPC request.

Diagnostic file reads are capped before parsing:1MiB per checkpoint/operation trace,
64KiB per raw event/wait file and4MiB aggregate per raw directory. Truncation and
partial lines remain explicit evidence. These bounds supplement the one-second live
snapshot request; capture is best-effort, not a wall-clock guarantee for filesystem I/O.
