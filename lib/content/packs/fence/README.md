# Dormant protocol-2 Pack execution fence

This source is opt-in through the **internal fifth argument** to `processPackOperation`. Existing REST/MCP callers do not provide it, no public schema accepts it, and no environment flag enables it. Public and legacy launches remain protocol 1. This change does not provide a stale-worker guarantee for legacy executions.

The paired Database branch `codex/pack-worker-fence-2269` contains inactive SQL under `proposals/pack-worker-fence-2269/`; nothing is placed in a migration/deployment runner. Root owns paired acceptance, merge and later rollout. Do not enable protocol 2 against an unqualified hosted schema.

## Original identity, not current-row adoption

An admitted transition carries a stable request UUID, source execution UUID/version, and (for resume) source claim and paid attempt. PostgreSQL issues the next execution UUID/version only once; exact transition replay never dispatches or holds again. The launch fence is passed through Workflow arguments. Preparation validates it after its read; production also compares the actual Workflow metadata before claiming. Asset writes use the issued claim and original paid attempt. Context updates compare context version. No helper fills missing identity from a newer job.

Claim replay is a reconciliation result, not a second production permit. Uncertain resume claims the same paid attempt under a new execution and preserves provider IDs and billing. Duplicate intent registration is likewise not permission to submit again.

## Receipts and failure behavior

The actual production adapter registers frozen provider intent in the fenced phase transaction, submits only after a fresh acknowledgement, and independently appends an allowlisted accepted/completed observation before saving the active phase. Full results remain in the existing phase path; only request ID and optional output hash enter the bounded journal. If append or active save is refused/uncertain, stop; do not mark a catch failure, settle a newer execution or resubmit the provider request.

The Workflow SDK reconstructs step errors. Protocol 2 therefore stops on any rejected step, not only `instanceof PackFenceError`. Its settlement uses the existing zero-retry bounded step outside the catch path. Foundation/bounded adapters propagate original identity and attempts; retained foundation dependents pass their plan/asset binding for SQL model validation. Those adapters and the lyric renderer remain unwired.

## Local checks

```sh
pnpm exec vitest run lib/content/packs app/workflows/packs
pnpm typecheck:release-packs
pnpm lint
node scripts/pack-fence-workflow-fixture/run.mjs
pnpm test:pack-scheduler-workflow
pnpm test:pack-admission-workflow
pnpm test:pack-foundation-workflow
```

`scripts/pack-fence-workflow-fixture/run.mjs` compiles the actual production workflow and steps with the installed Workflow SDK, replaces only persistence/provider leaves with synthetic effects, denies networking, and verifies rejection, one settlement attempt after lost acknowledgement, and terminal replay. `PACK_FENCE_SDK_OUTPUT=/absolute/path.json` writes source hashes and events.

For actual paired SQL integration, put PostgreSQL 17 binaries on PATH and supply the Database checkout explicitly:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/pack-fence-postgres/run.py --database /absolute/path/to/database-checkout
```

That runner creates and tears down an owned temporary Unix-socket PostgreSQL instance, applies the existing synthetic fixture and inactive proposal, and runs `packFencePostgres.test.ts`. Only Supabase RPC transport is adapted to that local database; production claim/intent/receipt/phase/completion helpers are real. Provider, caption, composition and inspection effects are synthetic. The five integration tests are skipped in ordinary Vitest runs and must be qualified through this explicit runner. They cover charging/completion and claim replay, actual Workflow mismatch, foundation-dependent image-edit and rejection of unretained bindings, and a committed acceptance surviving refused phase without catch finish or charge.

These checks do not establish hosted grants, deployed behavior, live provider execution, cancellation of in-flight I/O, automatic reconciliation, cache/QA freshness, legacy drain or customer outcomes. Unknown intent is not safe to resubmit. No new wallet, rates, paid runtime or public activation is included.
