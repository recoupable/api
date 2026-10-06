# Gated OAuth runtime and consent

`pages/api/oauth/[...path].ts` is disabled unless `OAUTH_ENABLED=true`. When enabled, `/mcp` accepts durable OAuth grants through a separate audited tool allowlist. Keep the gate off until migrations, stable secrets, live identity validation and deployment checks are complete.

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
| `REDIS_URL` | Shared Redis service for atomic OAuth request budgets; unavailable Redis fails closed |

The loader rejects duplicate symmetric secrets. HTTP is accepted only for `127.0.0.1` test fixtures. The runtime requires Node 22 or a provider-supported newer version and all three database migrations from database PR #81. The separate app repository implements the screen in [app PR #2163](https://github.com/recoupable/app/pull/2163), at `app/oauth/authorize/page.tsx`; that server-side route consumes `OAUTH_CONSENT_ENABLED=true` and the same canonical `OAUTH_ISSUER`.

## Request budgets

Before runtime initialization, every enabled request consumes atomic shared Redis budgets: 1,200 requests/minute per issuer and 120/minute per socket peer. Registration additionally allows 100/minute per issuer and 10/minute per peer. Excess traffic receives 429 with Retry-After. Redis failure returns a generic 503 with a redacted availability event; request bodies, tokens, addresses and backend error details are never logged.

Peer identity uses the socket address, never caller-controlled forwarded headers. Behind a platform proxy, unrelated clients may share that peer budget. Validate deployment behavior and configure edge per-client limits before public launch; do not blindly trust X-Forwarded-For to increase capacity. These conservative application budgets protect storage work but do not replace edge DDoS controls.

The Redis integration test starts an isolated Unix-socket server with persistence disabled and TCP disabled when `OAUTH_TEST_REDIS_SERVER` points to a local binary. It verifies concurrent budgets, rejected requests not consuming shared capacity, expiry recovery and fail-closed handling of counters without TTL. CI installs a local test binary; no production Redis is used in these tests.

## Browser journey

1. The provider validates the OAuth request and sets signed interaction/resume cookies.
2. Its interaction URL remains on the API so the cookie path covers subsequent consent requests. The API validates that cookie and redirects navigation to the configured chat screen with only the interaction ID.
3. The screen uses Privy login, then requests consent metadata with credentials and the Privy bearer token. Only the exact configured chat Origin receives credentialed CORS.
4. The server resolves an existing account, derives permissions from the stored authorization request, and issues an encrypted five-minute approval ticket bound to the interaction, account, Privy subject, client, resource, and scopes.
5. An explicit approve/deny POST contains only the decision and ticket. Atomic ticket consumption rejects replay and concurrent consumption. Approval creates a 30-day personal-account grant and attribution record. Denial resumes with `access_denied`.
6. The screen accepts only an issuer `/api/oauth/auth/` resume URL. The provider validates and performs the final client callback.

Access tokens last five minutes. Refresh rotation cannot extend the original grant lifetime. Each new authorization requires explicit consent. Organization access is not included in this first consent slice. Unknown scopes fail closed. Client display names are unverified text; no client-hosted logos are loaded.

Chat and API should use same-site HTTPS domains. Arbitrary Vercel preview URLs may be cross-site and lose interaction cookies under browser third-party-cookie restrictions; use coordinated same-site preview domains for live browser validation. Do not weaken cookie protections as a workaround.

## Evidence and remaining work

The real HTTP test uses Next's actual Pages resolver, the runtime provider and consent handler, path-aware cookies, synthetic authenticated identities, and (under the PostgreSQL runner) the encrypted durable adapter. It verifies invalid origin/cookie/account/scope/replay rejection, approval, denial, exact read/write scopes, refresh rotation, attribution and fixed grant lifetime. This does not verify a real Privy account, deployed proxy behavior, a named agent application, production deployment behavior or organization roles. The same test now exchanges a real provider token into the actual delegated MCP tool registration via the SDK, performs a synthetic artist write, rejects an account override, and rejects original and refreshed access tokens after grant revocation.

The protocol lab exercises CIMD with synthetic documents; the runtime deliberately leaves network CIMD disabled pending safe fetching. DCR remains supported for clients, including ChatGPT, which documents DCR fallback when CIMD is unavailable: https://developers.openai.com/plugins/build/auth . Callback-pattern fixtures are not proof of a named application connection.

## Delegated MCP and connection management

Launch scopes are `mcp:read` and `mcp:write`. Only `list_artists`, `create_new_artist`, `update_account_info`, `get_artist_socials`, and `get_chats` are registered for delegated credentials. Personal artists require direct ownership and no organization association. Chats are bounded to the authenticated account and personal artist contexts. Tools that reveal API keys, send messages, publish content, spend credits, delete records, or schedule continuing work are not delegated. Existing API-key and Privy clients retain their existing server.

Every tool execution revalidates the token, active grant, account, audience and approved scope. Clients cannot supply an owner account. Revocation blocks subsequent operations; it cannot undo a write already in progress or completed.

- `/.well-known/oauth-protected-resource/mcp` and the origin-level alias publish the exact `/mcp` resource and supported scopes.
- `/.well-known/oauth-authorization-server/api/oauth` serves the provider's discovery document, with canonical `/api/oauth` issuer.
- `/mcp` returns a canonical resource-metadata challenge and supports bearer-only browser CORS.
- `/api/oauth/connections` lists encrypted grant metadata for the verified first-party Privy account. `DELETE /api/oauth/connections/<id>` revokes that account's selected grant. These routes require the exact app Origin and first-party login, not delegated tokens.
- App `/oauth/connections`, linked from Settings → Connectors, lists permissions/expiry and provides revocation. Storage is service-only and indexed by HMAC account identifiers, not plaintext account IDs.

## Release sequence and outstanding live proof

1. Review and merge database PR #81 (three migrations), API PR #963, and app PR #2163 through the normal release workflow. Apply database migrations to the verified Recoup production project before enabling the API gate.
2. Configure stable API secrets above, `OAUTH_ISSUER=https://api.recoupable.dev/api/oauth`, and consent URL on **app.recoupable.dev**. Do not rotate the stable index key casually. Configure the app's `OAUTH_ISSUER` and `OAUTH_CONSENT_ENABLED`; enable `OAUTH_ENABLED` only for the coordinated release.
3. Verify actual deployed metadata, canonical challenge, Redis/proxy request budgets and existing-account Privy login. Existing local protocol/browser tests use synthetic identities and data.
4. Connect available named clients, perform a clearly labeled reversible personal artist create/update, inspect Connected Agents, revoke, and verify old/refresh credentials fail. Record each surface separately; callback registration acceptance alone is not interoperability evidence.
5. Disable `OAUTH_ENABLED` to stop delegated requests if live verification fails; preserve keys and durable records for diagnosis. Existing independently verified API keys remain usable.

The current Supabase connector/CLI credentials do not list the Recoup project; production migration access must be established before release. Vercel CLI access to the Recoup team is verified; the Vercel connector itself returns a scope permission error. No live identity or named-client claim should be inferred from this implementation.
