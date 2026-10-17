# Published response contracts

`lib/networking/errorResponseSchemas.ts` owns the existing error and authentication
message envelopes. The response constructors use the inferred types; neither envelope
is renamed. `pnpm typecheck:response-contracts` checks the constructors and rejects
missing message/error fields and a success status.

Regenerate the OpenAPI artifact after changing these schemas:

```sh
RECOUP_ERROR_SCHEMA_OUTPUT=lib/contracts/generated/error-responses.json pnpm exec vitest run lib/contracts/__tests__/errorResponseSchemas.test.ts
```

Then run Marketing's `scripts/build-contract-examples.py --api /path/to/api` to
import that artifact into the selected components and refresh both copies of the
published fixture. The export test remains red until the coordinated fixture matches.
Commit API first; Marketing's operation inventory pins that API commit. Its CI checks
the artifact, selected schemas, operation/status identities and both fixture copies.
The API fixture records Marketing source-file hashes rather than a circular commit pin.

`publishedResponses.test.ts` calls the actual Artist Profile and Project GET exports
with real Next request/response and auth code. Only external dependency seams are
mocked. It checks Artist 404, both Projects 401 envelopes, and Projects 404; it does not
claim coverage of every API error or hosted authentication. It also rejects the old
message-only Artist schema and responses missing required fields.
