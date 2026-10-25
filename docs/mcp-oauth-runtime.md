# OAuth runtime and consent

`pages/api/oauth/[...path].ts` is disabled unless `OAUTH_ENABLED=true`. When enabled, `/mcp` accepts durable OAuth grants through a separate audited tool allowlist. This is a source-level operating guide, reconciled October 24, 2026. The foundation and later lifetime/full-scope/CIMD releases are recorded in [Mono #207](https://github.com/recoupable/mono/issues/207); do not repeat their initial enablement sequence. A new environment still requires its own migration, stable-secret, identity and deployment checks. This document does not attest to current deployment configuration.

## Stable configuration

No secrets are generated at runtime. Missing or malformed configuration returns a generic 503 when enabled. Supply secrets through the deployment secret manager, never source control:

| Variable | Value |
| --- | --- |
| `OAUTH_ISSUER` | Canonical HTTPS API origin plus `/api/oauth` |
| `OAUTH_CONSENT_URL` | `https://app.recoupable.dev/oauth/authorize` for production (chat.recoupable.dev redirects there) |
| `OAUTH_SIGNING_JWKS` | Private RSA signing JWKS, RS256, unique key IDs, minimum 2048 bits |
| `OAUTH_COOKIE_KEYS` | JSON array of 1–3 base64 32-byte keys, current first |
| `OAUTH_INDEX_KEY` | Stable base64 32-byte lookup key; do not rotate independently of stored records |
| `OAUTH_ENCRYPTION_KEYS` | JSON object of key IDs to base64 32-byte encryption keys |
| `OAUTH_ACTIVE_ENCRYPTION_KEY` | Current encryption key ID; retain old keys while their records exist |

The loader rejects duplicate symmetric secrets. HTTP is accepted only for `127.0.0.1` test fixtures. The runtime requires Node 22 or a provider-supported newer version and the provider migrations from database PR #81, `20261006190000_oauth_rate_limits.sql` (database #82), and `20261008010000_oauth_persistent_connections.sql` (database #84). Additional enabled features retain their own migration prerequisites; this list is not authorization to apply migrations. The separate app repository implements the screen in [app PR #2163](https://github.com/recoupable/app/pull/2163), at `app/oauth/authorize/page.tsx`; that server-side route consumes `OAUTH_CONSENT_ENABLED=true` and the same canonical `OAUTH_ISSUER`.

## Request budgets

Before runtime initialization, every enabled request consumes atomic shared Supabase/PostgreSQL budgets: 1,200 requests/minute per issuer and 120/minute per socket peer. Registration additionally allows 100/minute per issuer and 10/minute per peer. Excess traffic receives 429 with Retry-After. Database failure returns a generic 503 with a redacted availability event; request bodies, tokens, addresses and backend error details are never logged.

Peer identity uses the socket address, never caller-controlled forwarded headers. Behind a platform proxy, unrelated clients may share that peer budget. Validate deployment behavior and configure edge per-client limits before public launch; do not blindly trust X-Forwarded-For to increase capacity. These conservative application budgets protect storage work but do not replace edge DDoS controls.

The service-only `consume_oauth_rate_limit` RPC checks and increments all applicable budgets in one transaction. Identifiers are HMAC hashes. Counters expire after one minute; each request removes expired rows for its issuer using an expiry index. Transaction-scoped issuer locks prevent concurrent oversubscription. Rejected requests do not consume another budget or create peer rows. The database repository tests concurrency, expiry cleanup, isolation, validation, and role permissions against disposable PostgreSQL. OAuth has no Redis dependency. Counter RPCs have a two-second deadline and abort on timeout.

## Browser journey

1. The provider validates the OAuth request and sets signed interaction/resume cookies.
2. Its interaction URL remains on the API so the cookie path covers subsequent consent requests. The API validates that cookie and redirects navigation to the configured chat screen with only the interaction ID.
3. The screen uses Privy login, then requests consent metadata with credentials and the Privy bearer token. Only the exact configured chat Origin receives credentialed CORS.
4. The server resolves an existing account, derives permissions from the stored authorization request, and issues an encrypted five-minute approval ticket bound to the interaction, account, Privy subject, client, resource, and scopes.
5. An explicit approve/deny POST contains only the decision and ticket. Atomic ticket consumption rejects replay and concurrent consumption. Approval creates an account-bound grant and attribution record with access until disconnected; the attribution context remains `personal`, including for full-tool grants. Denial resumes with `access_denied`.
6. The screen accepts only an issuer `/api/oauth/auth/` resume URL. The provider validates and performs the final client callback.

Access tokens last five minutes and refresh tokens rotate. New approvals have no user-facing expiry (`expiresAt: null`); the provider uses the bounded sentinel in `lib/oauth/oauthPersistentExpiry.ts`. Existing finite approvals retain their original deadline, which refresh cannot extend. Each new authorization requires explicit consent. Full-tool scope permits currently accessible workspace resources through execution-time checks; it does not implement a per-connection selected-organization grant. Unknown scopes fail closed. Client display names are unverified text; no client-hosted logos are loaded.

Chat and API should use same-site HTTPS domains. Arbitrary Vercel preview URLs may be cross-site and lose interaction cookies under browser third-party-cookie restrictions; use coordinated same-site preview domains for live browser validation. Do not weaken cookie protections as a workaround.

## Consent storage diagnostics

As of October 25, 2026, the consent handler emits the fixed `oauth_consent_storage_unavailable` event through the existing server error-log convention when an adapter storage boundary throws `OAuthStorageUnavailableError`. The payload contains only the event name; it includes no exception, cause, stack, request fields, account/client identifiers or credentials. Approval still attempts grant cleanup before reporting a storage failure. The public response remains HTTP 400 with `invalid_or_expired_interaction`.

Expired or invalid interactions, invalid identity, ticket replay and explicit denial do not emit this storage event. An arbitrary exception with the same message is not classified as storage failure. This narrow signal does not diagnose identity-provider failures or arbitrary provider exceptions, establish request correlation, or complete the broader event, access-control and retention requirements in [Mono #214](https://github.com/recoupable/mono/issues/214). Local mocked-handler tests exercise the real encrypted adapter and approval helper; deployed log delivery remains unverified.

## Evidence and remaining work

The real HTTP test uses Next's actual Pages resolver, the runtime provider and consent handler, path-aware cookies, synthetic authenticated identities, and (under the PostgreSQL runner) the encrypted durable adapter. It verifies invalid origin/cookie/account/scope/replay rejection, approval, denial, exact read/write scopes, refresh rotation, attribution, persistent new approvals and legacy finite deadlines. This does not verify a real Privy account, deployed proxy behavior, a named agent application, production deployment behavior or organization roles. The same test now exchanges a real provider token into the actual delegated MCP tool registration via the SDK, performs a synthetic artist write, rejects an account override, and rejects original and refreshed access tokens after grant revocation.

The runtime enables DCR and network CIMD. `createOAuthMetadataFetch.ts` permits credential-free public HTTPS GETs with pinned validated DNS, no redirects, a 2.5-second deadline and at most eight in-flight fetches. Provider response bodies are bounded to 16 KiB, and metadata freshness is capped at five minutes without stale fallback. URL, document identity, callback and private-key validation remain enforced. The lab uses synthetic CIMD documents; callback-pattern fixtures are not proof of a named application connection. Pre-registration in the generic lab is not evidence of a supported production provisioning path.

The consent integration suite also exercises two independently registered clients under one synthetic account for both limited and full scopes: wrong-client refresh rejection, rotation, selective revocation, unaffected second-client verification/refresh, and fresh consent/reconnection without reviving old tokens. The original lifecycle cases invoke the adapter grant-revocation boundary. Additional PostgreSQL-only cases mount the actual Connected Agents GET/DELETE controller through the Node/Next Pages boundary: foreign-owner enumeration/revocation, delegated-token DELETE and untrusted-origin DELETE are denied without changing either grant; owner DELETE removes only the selected connection, and repeating it is harmless. These cases rejoin the same token rejection, second-client refresh and reconnect assertions. They do not exercise the Connected Agents UI, the outer production rate-limit/configuration gate, or real Privy identity verification. Memory execution is protocol evidence; the disposable PostgreSQL runner additionally exercises encrypted storage, not production storage.

## Delegated MCP and connection management

Limited scopes remain `mcp:read` and `mcp:write`. For these grants, only `list_artists`, `create_new_artist`, `update_account_info`, `get_artist_socials`, and `get_chats` are registered for delegated credentials. Personal artists require direct ownership and no organization association. Chats are bounded to the authenticated account and personal artist contexts. Those limited grants do not gain messaging, publishing, paid, deletion or scheduling tools.

A separate `mcp:tools` approval enables the business catalog through `registerFullOAuthTools.ts`, `fullOAuthToolPolicy.ts` and `prepareFullOAuthTool.ts`. Existing limited grants never broaden automatically. Current account/grant/resource checks and domain permissions apply; scope consent does not substitute for action approval, roles or billing entitlements. Credential-returning and explicitly excluded professional-roster/catalog/Context operations remain unavailable. Use the executable registration/policy for the current inventory, not a fixed universal tool count. Existing API-key and first-party Privy clients retain their separate standard path; this is a source distinction, not fresh regression acceptance.

Every tool execution revalidates the token, active grant, account, audience and approved scope. Clients cannot supply an owner account. Revocation blocks subsequent operations; it cannot undo a write already in progress or completed.

- `/.well-known/oauth-protected-resource/mcp` and the origin-level alias publish the exact `/mcp` resource and supported scopes.
- `/.well-known/oauth-authorization-server/api/oauth` serves the provider's discovery document, with canonical `/api/oauth` issuer.
- `/mcp` returns a canonical resource-metadata challenge and supports bearer-only browser CORS.
- `/api/oauth/connections` lists encrypted grant metadata for the verified first-party Privy account. `DELETE /api/oauth/connections/<id>` revokes that account's selected grant. These routes require the exact app Origin and first-party login, not delegated tokens.
- App `/oauth/connections`, linked from Settings → Connectors, lists permissions/expiry and provides revocation. Storage is service-only and indexed by HMAC account identifiers, not plaintext account IDs.

## Support, rollback and remaining acceptance

The original foundation enablement is historical. For new environments or an approved release, verify the actual owning migration/release prerequisites, stable configuration, issuer/resource and serving revision separately. Do not infer production schema or client behavior from CI or a source merge. Use authorized connectors; a permission denial is not authorization to switch to local credentials or another transport.

| Symptom | Bounded investigation / recovery |
| --- | --- |
| Discovery or registration fails | Record host/version, timestamp, sanitized status/error class, exact public callback and issuer/resource. Distinguish client/admin policy from registration/transport rejection. Do not widen callbacks to make a client pass. |
| Consent fails or loops | Check same-site domain/cookie behavior, configured exact Origin and intended existing account. Start a new authorization after expiry/denial; never export Privy or OAuth credentials for diagnosis. |
| Token is rejected | Check expiry, current grant/account/client/resource binding through authorized diagnostics. Reconnect through fresh consent when revoked; do not repeatedly replay a refresh token. |
| Connected but a tool is denied/missing | Check limited versus full approval and current resource/role/domain policy. A new full-scope approval does not change membership, entitlements or action approval. |
| Write times out or disconnects | Verify the operation's existing receipt/state before retrying. Do not blindly replay email, deletion, paid work or other non-idempotent operations. |
| OAuth service returns 429/503 | Check Retry-After, shared budgets, configuration and storage availability using redacted diagnostics. No secret, token, authorization code or private payload belongs in support logs. |

An authorized rollback may disable `OAUTH_ENABLED` to stop delegated verification and OAuth routes; preserve keys and durable records. Existing independent API-key and first-party paths require their own regression check. Disabling OAuth or disconnecting a grant does not cancel work already accepted or undo completed effects. This is a source-backed rollback procedure, not evidence that a production rollback was exercised. Configuration/deployment changes require the owning release approval.

[Mono #215](https://github.com/recoupable/mono/issues/215) holds dated client receipts and the remaining per-host connect/read/write/readback/refresh/revoke/reconnect matrix. Keep each actual host/version, callback, registration mechanism, actor/scope and serving revision distinct. A controlled local test is not named-client acceptance. Intended-account connection availability, a supported host, and scoped live-write permission are separate prerequisites; paid/outbound tests additionally require their approved budget/recipient.

[Mono #208–216](https://github.com/recoupable/mono/issues/207) retain the unfinished selected-organization, role-loss, action/retry, observability, UI and production launch criteria. This reconciliation neither closes those gates nor asserts current credentials, connector access, deployment state or complete operational dashboards.
