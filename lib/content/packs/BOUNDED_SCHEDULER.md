# Bounded pack scheduling candidate

`runBoundedPackProduction` is an **unwired orchestration candidate** for app issue
[2273](https://github.com/recoupable/app/issues/2273). The production
`releasePackWorkflow` remains sequential. No route, workflow registration, model,
price, approval, reservation, or provider adapter is changed. There is no production
concurrency default or environment switch.

The caller supplies a positive safe-integer concurrency bound and the existing
`preparePackStep`, `producePackAssetStep`, and `settlePackStep` services. The controlled
fixtures use explicit limits; they do not select a production cap.

## Execution contract

1. Await shared preparation once before scheduling any asset. Use its existing job,
   source snapshot, retained analysis and pending asset IDs. This helper does not
   invent readiness for downstream edits, assemblies, or cross-asset dependencies.
2. Deduplicate those ready IDs and run at most the supplied number of asset steps
   in this invocation. Reuse the same prepared job for every step. A freed slot can
   admit another ready asset without waiting for the entire batch.
3. Existing durable claims decide whether an asset can run. Completed, failed and
   uncertain assets are not automatically retried; ordinary preparation returns
   only pending IDs. Keep the existing explicit recovery/approval paths separate.
4. Existing production steps retain provider receipts and record inspection failure
   or provider uncertainty. These saved outcomes are not thrown scheduler errors;
   independent ready assets may continue. The scheduler reserves no budget, starts
   no workflow, and dispatches no provider itself.
5. If a step rejects unexpectedly (for example, its claim or persistence response
   fails), stop admitting new IDs. Await all already-started steps before calling
   settlement with the error. No fail-fast `Promise.all` may settle while a worker
   is still running. Preparation failure also settles without dispatching.
6. Call settlement once. A settlement rejection propagates to the caller; it does
   not trigger a second settlement call or automatic retry.

## Qualification and limits

Tests exercise the real existing prepare/produce/settle functions and asset pipeline
with controlled persistence and production-service fixtures. They check the bound,
preparation barrier, slot refill, retained files/receipts, failed and uncertain
outcomes, duplicate step claims, no new budget command, and drain-before-settlement.
A production-workflow fixture verifies that its current concurrency stays one.
This is not a real database transaction or live-provider concurrency qualification.

The bound is **per orchestration invocation**, not a global provider semaphore or a
cross-workflow execution lease. The caller must preserve the existing single-workflow
admission and durable replay boundaries; a second independent scheduler invocation
is not a supported way to resume a running pack. Claims alone do not authorize a
second workflow or early settlement of another run's assets. A hung in-flight step
keeps settlement waiting; outcome recovery remains with existing durable step and
provider receipt handling, not a scheduler timeout that could release its budget.

Before production wiring, the owner must qualify the candidate in Vercel Workflow
orchestration with durable replay/crash behavior and the existing single-run and
budget invariants, approve a provider/tier/license/cap policy, and satisfy the
existing funding and human-quality acceptance gates. Shared artwork, lyric alignment
and downstream dependency readiness beyond today's preparation snapshot remain
separate acceptance work. These source fixtures do not close issue 2273.
