# Owner-scoped key-management authentication headers

GET, POST and DELETE `/api/keys` now use the existing shared
`validateAuthContext(request)` without account or organization overrides.
Supported credentials are a personal Recoup API key in `x-api-key`, a Recoup API
key as an Authorization Bearer token, or a Privy Bearer token. Bearer API keys
already supported owner-scoped management before this change.

Exactly one header must be provided. Missing or simultaneous credentials receive
the shared validator's 401 `{ status: "error", error }` envelope. Invalid single
credentials retain their existing authentication helper's 401 responses. Callers
sending both headers must select one. No OAuth/delegated scope, organization-key
policy, cross-account override or new key-management authority is introduced.

List/create use the credential's account. Delete retains its existing comparison
between the selected key's account and that authenticated account. Request body
or query account/organization identifiers do not select a different owner.
Existing body validation, success shapes and persistence error paths are unchanged.

Verification uses real route exports, handlers, shared validator and header auth
helpers with synthetic credential lookup, Privy and key-operation adapters. The
36 handler cases cover all three credential paths across all operations, missing,
invalid, malformed and simultaneous credentials, foreign-owner deletion denial,
and ignored account/organization overrides. With corrected fixtures these tests
reproduce 16 failures/20 passing controls on the base and pass after the repair.
Broader key/auth tests:75 cases/8files pass. Focused types, ESLint, Prettier and
diff checks pass. No real credentials, key generation/storage/deletion, database,
Privy or network calls occurred. This is mocked behavior proof, not hosted proof.
