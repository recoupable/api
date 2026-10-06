# Encrypted OAuth provider storage

Part of [Mono #209](https://github.com/recoupable/mono/issues/209). Requires [database PR #81](https://github.com/recoupable/database/pull/81), including `oauth_store_find.id_hash` from commit `dae0768`. This implements persistence components; no production OAuth route is enabled.

## Components

- `lib/oauth/createOAuthCipher.ts`: AES-256-GCM with random 96-bit nonces, versioned key IDs, and associated data binding issuer namespace, model and hashed record ID. Old encryption keys remain readable during rotation. Corrupt, mismatched or unknown-key records fail closed.
- `lib/oauth/createOAuthAdapter.ts`: provider adapter with keyed identifier hashes, encrypted payloads, database-authoritative consumption state and invalid-grant errors when atomic consumption loses. The index key is separate from encryption keys and must remain stable for existing records.
- `lib/supabase/oauth_provider_artifacts/createOAuthStore.ts`: validated RPC contract. Errors never return database detail or raw provider payloads.
- `lib/supabase/oauth_provider_artifacts/getOAuthStore.ts`: bridge to the existing server-only Supabase client. It is not imported by a production route. Regenerate database types after deploying the migration to replace the narrow RPC type assertion.

Configuration must supply a canonical issuer/environment namespace, a managed 32-byte index key, an active encryption key ID and a managed key ring of 32-byte keys. Never reuse fixture keys. Keep old encryption keys until all corresponding records are expired or re-encrypted; removing a key makes those records unreadable. Losing/changing the index key requires reconnecting clients because lookups can no longer find existing records. Production configuration and secret provisioning remain a release gate.

Only Client registrations may have no expiry. The lab disables registration-management token issuance: the provider defaults to permanent RegistrationAccessTokens, which the adapter deliberately rejects. This does not disable dynamic client registration or authorization-code exchange.

## Verification

Unit/HTTP suite on Node 22 LTS:

```sh
pnpm typecheck:mcp-oauth
pnpm test:mcp-oauth
```

The default suite uses in-memory provider storage for HTTP tests and skips the PostgreSQL-only concurrency test. CI runs this default suite. To exercise the same HTTP flows through encrypted PostgreSQL storage, provide the owning database checkout's migration:

```sh
PG_BINDIR=/path/to/postgresql/bin \
  scripts/mcp-oauth/testPostgres.sh \
  /path/to/database/supabase/migrations/20261005170000_oauth_provider_store.sql
```

Run with Node 22 on PATH, or set `OAUTH_TEST_NODE` to its executable. The script creates a disposable Unix-socket cluster with no TCP listener, applies only the specified migration and test roles, runs the entire suite, then stops/removes its cluster. It never reads DATABASE_URL, contacts Supabase, or applies a migration to shared infrastructure. The psql bridge is fixture-only, not the production database client.

Verified locally: 42 tests on Node 22 and PostgreSQL 17, including real HTTP registration/callback exchange, read/write scopes, refresh rotation and replay, grant revocation, persistence across adapter recreation, and eight concurrent redemption attempts with one winner. This is not a full Supabase migration-history or PostgREST deployment test. The named-client tests still use synthetic clients and synthetic consent.

## Remaining runtime gates

Stable production configuration, Next/Vercel Node mounting, existing-account Privy mapping, consent and Connected Apps UI, resource-server token validation, tool-specific authorization, real client connections and production verification remain outstanding. Do not enable production OAuth by mounting the lab: it uses synthetic identity/consent and ephemeral signing/cookie keys.
