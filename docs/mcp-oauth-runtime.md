# Gated OAuth runtime and consent

`pages/api/oauth/[...path].ts` is disabled unless `OAUTH_ENABLED=true`. This is an implementation gate, not a launch-ready flag: production MCP still does not accept these OAuth tokens. Do not enable on a public deployment until tool authorization, discovery, registration abuse controls, revocation UI and live identity/client validation are finished.

## Stable configuration

No secrets are generated at runtime. Missing or malformed configuration returns a generic 503 when enabled. Supply secrets through the deployment secret manager, never source control:

| Variable | Value |
| --- | --- |
| `OAUTH_ISSUER` | Canonical HTTPS API origin plus `/api/oauth` |
| `OAUTH_CONSENT_URL` | Canonical HTTPS chat origin plus `/oauth/authorize` |
| `OAUTH_SIGNING_JWKS` | Private RSA signing JWKS, RS256, unique key IDs, minimum 2048 bits |
| `OAUTH_COOKIE_KEYS` | JSON array of 1–3 base64 32-byte keys, current first |
| `OAUTH_INDEX_KEY` | Stable base64 32-byte lookup key; do not rotate independently of stored records |
| `OAUTH_ENCRYPTION_KEYS` | JSON object of key IDs to base64 32-byte encryption keys |
| `OAUTH_ACTIVE_ENCRYPTION_KEY` | Current encryption key ID; retain old keys while their records exist |

Use independent random secrets for each purpose. HTTP is accepted only for `127.0.0.1` test fixtures. The runtime requires Node 22 or a provider-supported newer version and both database migrations from database PR #81. The chat screen has its own server-side gate, `OAUTH_CONSENT_ENABLED=true`, and the same canonical `OAUTH_ISSUER`.

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

The real HTTP test uses Next's actual Pages resolver, the runtime provider and consent handler, path-aware cookies, synthetic authenticated identities, and (under the PostgreSQL runner) the encrypted durable adapter. It verifies invalid origin/cookie/account/scope/replay rejection, approval, denial, exact read/write scopes, refresh rotation, attribution and fixed grant lifetime. This does not verify a real Privy account, deployed proxy behavior, a named agent application, production MCP authorization, or organization roles.

The protocol lab exercises CIMD with synthetic documents; the runtime deliberately leaves network CIMD disabled pending safe fetching. Add public protected-resource/authorization-server discovery, registration limits and client policy before launch. Complete Connected Apps and tool-level resource authorization before accepting OAuth tokens on `/mcp`.
