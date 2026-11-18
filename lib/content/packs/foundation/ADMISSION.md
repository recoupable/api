# Admission ordering qualification

The foundation factory remains unwired. Its first read requires the job's saved
workflow ID to match the executing run. The current sequential workflow establishes
its own ID in `preparePackStep`; this does not qualify the factory's earlier read.

## Existing ordering and authority

`processPackOperation` approves through the existing owner/org RPC, calls Workflow
`start`, then persists the returned ID through `run`. In the installed Workflow
core 4.2.4 implementation, `start` creates the run and queues execution before it
returns. `StartOptions` exposes neither a caller-selected run ID nor deferred
enqueue. A workflow can therefore read before the dispatcher saves its ID.

`packFirstUse.test.ts` exercises the actual dispatcher and actual admission helper
with a controlled start boundary and mocked database semantics. An early read
rejects without preparation, claim, context write, provider work or settlement.
After a successful ID write, the same run passes admission. If that write fails,
the existing dispatch-uncertain path preserves the hold; admission remains denied.
A repeated approval does not dispatch again when the modeled database returns
`dispatch: false` for an already-running job. This is source/mock qualification,
not a real database transaction or compiled admission-workflow execution.

The database contract's `run` action writes the ID on a running job without comparing
an expected previous ID. Consequently, moving that write into the new initial read
would allow self-admission, not prove ownership. The reused preparation also writes
`run`. Neither operation establishes a lease or atomically fences another run.
Do not relax the strict initial read or overwrite a different ID to make tests pass.

## Next bounded contract, not an activated policy

A read-only admission wait is a candidate for separate implementation: tolerate only
an absent ID, use fresh durable reads separated by durable waits, and proceed only
when the saved ID matches current Workflow metadata. Different IDs, denied access,
non-running jobs and expired holds must fail closed. A cached step result must not
be mistaken for a fresh read. Read reconciliation retains the database's existing
expired-hold behavior; no hold extension or funding action is implied.

Production use still requires selecting timeout policy and the observable owner
continuation when dispatch persistence or its acknowledgement is lost. Required evidence covers
early execution, delayed persistence, restart during wait, wrong-run rejection,
expiry, read failures, timeout and no second dispatch/provider attempt. A wait solves
only the initial ordering gap; it does not solve cross-run takeover after admission.
There is no production entrypoint change, new retry, lease, cap, hold, or commercial
policy in the qualification tests.

## Scheduler fixture failure barrier

The earlier compiled scheduler fixture released its paused peer after seeing the
failed asset's claim trace. That trace precedes the step's thrown error and the
scheduler's observation of rejection, so another admission could legitimately occur
before `stopped` became true. A count of two providers was not justified by that trace.

The driver now keeps the peer paused until a successful completed workflow delivery
loaded the correlated terminal failure, and all workflow deliveries are idle. The
observer covers both the SDK's preloaded `run_started` event batch and paginated
`events.list` fallback, with separate context per delivery. It changes no event data.
The fixture's unique claim-loss error and matching produce-step correlation identify
the failed step; assertions also require that asset-2 is running at attempt one,
asset-3 remains pending, exactly two providers ran, and no settlement occurred before
peer release. Existing final no-duplicate-effect and one-settlement assertions remain.

This barrier relies on the installed SDK draining its failure promise queue before
returning from that replay delivery. It is local compiled replay evidence with
synthetic effects, not a hosted scheduling guarantee. Negative observer tests reject
outside-delivery reads, incomplete loads, unrelated failures, failed handlers and
combining events from concurrent deliveries. Keep the original failed CI evidence;
a passing deterministic fixture does not retroactively prove its complete event order.

The separately qualified [finite admission candidate](./ADMISSION_WAIT.md) implements
an unwired 30-second admission cutoff with durable fresh reads. It does not select
production timeout policy, change dispatch or solve atomic ownership.
