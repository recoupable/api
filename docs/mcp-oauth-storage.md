# Encrypted OAuth provider storage

Part of [Mono #209](https://github.com/recoupable/mono/issues/209). The storage foundation comes from [database PR #81](https://github.com/recoupable/database/pull/81), including `oauth_store_find.id_hash` from commit `dae0768`. Agent registration additionally requires [database PR #118](https://github.com/recoupable/database/pull/118) and its separately gated rollout.

## Components

- `lib/oauth/createOAuthCipher.ts`: AES-256-GCM with random 96-bit nonces, versioned key IDs, and associated data binding issuer namespace, model and hashed record ID. Old encryption keys remain readable during rotation. Corrupt, mismatched or unknown-key records fail closed.
- `lib/oauth/createOAuthAdapter.ts`: provider adapter with keyed identifier hashes, encrypted payloads, database-authoritative consumption state and invalid-grant errors when atomic consumption loses. The index key is separate from encryption keys and must remain stable for existing records.
- `lib/supabase/oauth_provider_artifacts/createOAuthStore.ts`: validated RPC contract. Errors never return database detail or raw provider payloads.
- `lib/supabase/oauth_provider_artifacts/getOAuthStore.ts`: bridge to the server-only Supabase client, used by `getOAuthRuntime`. Regenerate database types after deploying migrations to replace the narrow RPC type assertion.

Configuration must supply a canonical issuer/environment namespace, a managed 32-byte index key, an active encryption key ID and a managed key ring of 32-byte keys. Never reuse fixture keys. Keep old encryption keys until all corresponding records are expired or re-encrypted; removing a key makes those records unreadable. Losing/changing the index key requires reconnecting clients because lookups can no longer find existing records. Production configuration and secret provisioning remain a release gate.

Client registrations may have no expiry. Existing persistent consent also permits non-expiring Grant, RecoupGrant, and RefreshToken records when the adapter recognizes the persistent-approval marker. Agent registrations always have a finite deadline. Registration-management token issuance remains disabled: the provider defaults to permanent RegistrationAccessTokens, which the adapter deliberately rejects. This does not disable dynamic client registration or authorization-code exchange.

## Verification

Unit/HTTP suite:

```sh
pnpm typecheck:mcp-oauth
pnpm test:mcp-oauth
```

The default suite uses in-memory provider storage for HTTP tests and skips PostgreSQL-only cases. CI runs this default suite. The command below runs the whole suite and enables PostgreSQL-backed provider, adapter, and two-instance registration cases. Agent registration HTTP tests still use the in-memory fixture. Provide these migrations from the owning database checkout (including database PR #118):

```sh
PG_BINDIR=/path/to/postgresql/bin \
  scripts/mcp-oauth/testPostgres.sh \
  /path/to/database/supabase/migrations/20261005170000_oauth_provider_store.sql \
  /path/to/database/supabase/migrations/20261006150000_oauth_connected_apps.sql \
  /path/to/database/supabase/migrations/20261006170000_oauth_grant_binding_integrity.sql \
  /path/to/database/supabase/migrations/20261008010000_oauth_persistent_connections.sql \
  /path/to/database/supabase/migrations/20261020040000_oauth_agent_registration_cas.sql
```

Run with the project's supported Node runtime on PATH, or set `OAUTH_TEST_NODE` to its executable. The script creates a disposable Unix-socket cluster with no TCP listener, applies only the specified migrations and test roles, runs the entire suite, then stops/removes its cluster. It never reads DATABASE_URL, contacts Supabase, or applies a migration to shared infrastructure. The psql bridge is fixture-only, not the production database client.

Local verification uses Node 24 and PostgreSQL 17; the runner prints the current test count. PostgreSQL-backed cases cover provider HTTP registration/callback exchange, read/write scopes, refresh rotation and replay, grant revocation, persistence across adapter recreation, and competing redemption attempts. The two-instance agent case covers approval, token issuance, and disconnection through the real encrypted store; its HTTP routing is tested separately in memory. This is not a full Supabase migration-history or PostgREST deployment test. Named-client tests use synthetic clients and synthetic consent.

## Remaining runtime gates

Local fixture success does not prove production configuration, live Privy login, or a particular client's interoperability. Agent registration remains disabled until its database/API/chat deployment sequence and account-holder consent, read-only access, and revocation checks in [agent-registration.md](agent-registration.md) are complete. Never mount the lab as a production service: it uses synthetic identity/consent and ephemeral signing/cookie keys.

See [login and Node boundaries](mcp-oauth-login-boundary.md) for the existing-account mapping and locally tested Next Pages adapter.
