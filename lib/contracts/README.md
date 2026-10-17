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
