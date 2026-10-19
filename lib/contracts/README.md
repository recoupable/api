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

The Context fixture's `evidenceResponseReferences` point to local definitions under `evidenceSchemas`.
`evidenceResponseReferenceSource` separately records the canonical Marketing
document and its OpenAPI pointers; `sourceHash` binds that document's exact bytes.
