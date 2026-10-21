# Published response contracts

`lib/networking/errorResponseSchemas.ts` owns the existing error and authentication
message envelopes. The response constructors use the inferred types; neither envelope
is renamed. `pnpm typecheck:response-contracts` checks the constructors and rejects
missing message/error fields and a success status.

Regenerate the OpenAPI artifact after changing these schemas:

```sh
RECOUP_ERROR_SCHEMA_OUTPUT=lib/contracts/generated/error-responses.json pnpm exec vitest run lib/contracts/__tests__/errorResponseSchemas.test.ts
```

Then run `python3 scripts/build-contract-examples.py --api /path/to/api` from
Marketing. It imports the artifact into the selected components and refreshes
Marketing's `content/docs/contracts/example-cases.json` and API's
`lib/contracts/fixtures/published-docs.json`. The export test remains red until the
coordinated fixture matches. Run the API contract tests and type check, then commit API.

From Marketing, run `python3 scripts/refresh-contract-inventory.py --api /path/to/api`
to pin that commit. Run both Python commands with `--check`, then
`python3 scripts/test_response_contracts.py`, `pnpm docs:build`, `pnpm docs:check`,
`pnpm test` and `pnpm build` before committing Marketing. Its CI checks
the artifact, selected schemas, operation/status identities and both fixture copies.
The API fixture records Marketing source-file hashes rather than a circular commit pin.

`publishedResponses.test.ts` calls the actual Artist Profile and Project GET exports
with real Next request/response and auth code. Profile, project-access and credential
dependencies are mocked. It checks Artist 404, both Projects 401 envelopes, and
Projects 404. The latter requires `error`; the authentication union is only for 401.
It does not claim coverage of every API error or hosted authentication. It also rejects
the old message-only Artist schema and responses missing required fields.

`publishedSandboxFiles.test.ts` checks the coordinated guarded-file examples:
the actual GET export returns the declared version/encoding fields, the POST
validator preserves the observed SHA, and the shared upload response builder
matches the published 200/409/500 schemas without dropping partial receipts.
Explicit declaration checks cover request `expected_sha`, GET `sha`/`encoding`,
and POST `errors`/`conflicts`; they do not cover every optional field. Accepting
extra JSON properties alone is not evidence that the docs declare them.
Authentication, account/repository lookup and file reads are mocked. These checks
do not write GitHub files or verify hosted authorization, sandbox concurrency or
client adoption. The examples and resolved schemas live in `guardedGitFiles` in
the same coordinated fixture, separate from the API-owned error-envelope export.

`publishedChatReadFailures.test.ts` binds the canonical chat POST/GET and six
session-chat exports to their published 500 schemas for failed chat lookups. The
tested failures stop before turn persistence or the corresponding chat writes.
These assertions do not describe every possible 500 path. Compatibility cases
retain the existing POST running/pending 200 resume behavior and GET's empty or
terminal finish-only 200 SSE. Authentication validation, storage and workflow
service leaves are synthetic. No real run or customer request occurs; client
text handling, Stop/disconnect and the held submission repair remain separate.

`buildContextOperationCatalog` exports the current request schemas and separates
delegated tool names from standard-only evidence tools. The Context fixture checks
both maps and the evidence receipt/page schemas. Generate the four exports with:

```sh
RECOUP_CONTEXT_SCHEMA_OUTPUT=/tmp/context-requests.json \
RECOUP_CONTEXT_MCP_OUTPUT=/tmp/context-mcp.json \
RECOUP_CONTEXT_STANDARD_MCP_OUTPUT=/tmp/context-standard-mcp.json \
RECOUP_CONTEXT_EVIDENCE_OUTPUT=/tmp/context-evidence.json \
pnpm exec vitest run lib/contracts/__tests__/contextContract.test.ts
```

Then update Marketing's canonical Context specification and
regenerate both fixture copies. Exported source contracts do not prove that the
required database release or any customer workflow is live.

The planning action is included after approval of its three additive public names.
`responseSchemas.catalogPlanning` exports its complete existing response, and
`responseReferences.plan_catalog_members` connects the action to that schema.
Export a self-contained planning handoff with
`RECOUP_CONTEXT_CATALOG_PLANNING_OUTPUT=/tmp/context-planning.json pnpm exec vitest run lib/contracts/__tests__/catalogPlanningContract.test.ts`.
The shared fixture checks request syntax, mapping, full response schema, and
copyable populated/empty examples against real HTTP/MCP processors with synthetic
auth/storage leaves. It does not establish live database access or provider execution.

All supported actions now have an explicit success-model reference and HTTP status
in `responseReferences` and `responseStatusCodes`. The response models describe
current source; they are not installed as runtime validators. Persisted request
input/output JSON and stored node/outcome metadata retain their existing flexible
shape. Request records exclude `claim_token`. Unavailable brief/review payloads
remain null; release cases expose metadata review only and unsupported rights or
distribution capabilities. Verification receipts are queued-work acknowledgments,
not completed verification or permission to collect.

Export the remaining operation models and representative examples before updating
Marketing's canonical Context specification:

```sh
RECOUP_CONTEXT_RESPONSES_OUTPUT=/tmp/context-responses.json \
RECOUP_CONTEXT_EXAMPLES_OUTPUT=/tmp/context-operation-examples.json \
pnpm exec vitest run lib/contracts/__tests__/contextResponseCatalog.test.ts lib/contracts/__tests__/contextOperationExamples.test.ts
```

The example exporter writes only after all 26 source examples pass schema,
HTTP/MCP parity and mocked-dispatch checks. Published-fixture drift can still make
that command fail after emitting the source artifact; this is intentional for
reviewed regeneration, not a passing publication check. Generate both fixtures
with Marketing's `scripts/build-contract-examples.py --api <api-worktree>` and
rerun it with `--check`, then rerun the API contract tests. Every frozen operation
example is compared to the actual processor result and its declared status.

Source anchors: `processContextOperation`, `processReleaseCaseOperation`,
`readContextRequest`, `compileContextBrief`, the catalog/execution storage adapters,
and `planning/readReleaseTrackObservations`. The documented row and RPC projections
are also defined in Database migrations `20260920010000_context_foundation.sql`,
`20260920020000_context_spotify_pipeline.sql`,
`20260923080000_context_execution_records.sql`,
`20260924070000_context_release_track_read.sql`,
`20260924110000_context_release_track_identity_review.sql`,
`20260926170000_context_brief_snapshots.sql`, and
`20261008160000_context_release_cases.sql` with its cursor correction. These are
source definitions, not proof that a target database has those migrations applied.
The fixtures use synthetic auth/storage and mocked dispatch, fence off native
fetch, and restore test feature flags. No provider, customer, paid job, database
read/write or hosted permission/retention acceptance is exercised.

The Context fixture's `evidenceResponseReferences` point to local definitions under `evidenceSchemas`.
`evidenceResponseReferenceSource` separately records the canonical Marketing
document and its OpenAPI pointers; `sourceHash` binds that document's exact bytes.

`publishedStoredComments.test.ts` consumes the `storedComments` fixture generated
from Marketing's Social specification. It calls the real `GET /api/comments`
wrapper, query validator and authentication mechanism selection with synthetic
auth/access/storage leaves. An unexpected database call is fenced off explicitly.
The cases cover the five-field projection, three nullable row fields, effective
limit clamping, offset/input rejection, both 401 envelopes, denial/missing targets,
masked 500s and private/no-store responses. They also reject wrong nullable types,
missing projected fields and extra joined metadata. The separate restored-route
and query suites retain ownership/join coverage; these contract fixtures do not
establish live PostgREST permissions, null-post inclusion or a customer report.

`publishedStoredCommentsWire.test.ts` connects the actual GET wrapper and
Supabase SDK to synthetic HTTP responses. It verifies the beyond-final-page
recovery returns an empty page with the exact same-scope count, preserves the
creator/post filters in the HEAD retry, and keeps missing counts, count failures
and unrelated backend errors as bounded 500s. This is SDK/HTTP-fixture evidence,
not a customer database or live report result.

`publishedPlanBalances.test.ts` compares the named public credits/subscription
examples in `planBalances` with the existing pure response builders. It covers
Free, paid Starter, direct and organization Pro, extra credits above the allowance,
signed balances, inactive subscriptions and unavailable timestamps/billing details.
It requires explicit standard null types, all projected required fields, integer
micro-dollar values and a schema-valid copyable guide example. The producer also
hashes the guide source. Stripe configuration is a synthetic fixture; no service,
account, refill, payment, price discovery or real subscription is exercised.

`publishedSitesLifecycle.test.ts` checks the guide's polling, selected-preview
publish, unpublish and existing deletion examples against both request schemas.
It checks route accounting through source files and serializes a synthetic paid-gate
error through the real HTTP adapter. Authentication and processSiteOperation are
mocked: no lifecycle implementation, workspace/subscription lookup, production
workflow, provider, publish, unpublish or delete operation runs. Static source
accounting and schema examples do not prove paid eligibility or hosted behavior.

`publishedAdminCodingSlack.test.ts` compares the documented author filter and
distinct-author options response with the actual admin GET exports, query and
authentication code. The fixture producer freezes both operations' request
declarations, examples and resolved response schemas. Slack collection and
credential/admin lookup leaves are mocked, with unexpected network/database
calls fenced off. Checks cover filtered totals, trimmed/unknown/omitted IDs,
first-profile deduplication, empty options, both 401 envelopes, 403, query 400
and masked collection 500 responses. This does not run a real Slack collector,
verify admin access, establish history completeness/latency/quotas or introduce
an automatic caller, UI, poller, scheduled action or Slack send.
