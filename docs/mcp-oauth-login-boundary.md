# OAuth login and Node runtime boundaries

Part of [Mono #209](https://github.com/recoupable/mono/issues/209). Source reconciliation: October 30, 2026. The opt-in [`pages/api/oauth/[...path].ts`](../pages/api/oauth/[...path].ts) route mounts [`getOAuthRuntime`](../lib/oauth/getOAuthRuntime.ts), which composes the provider, existing-account resolver, consent handler and Connected Agents handler. The app repository owns the consent and connection-management screens. See the maintained [runtime guide](mcp-oauth-runtime.md) for configuration, current policy and acceptance boundaries; this note does not attest to deployed configuration.

## Existing-account resolution

`resolveOAuthAccount` verifies a Privy access token, fetches that exact subject from Privy, then resolves its persistent Recoup account binding through the server-only database layer. It does not call account provisioning or send welcome emails. The normal app login resolver is unchanged.

The first binding requires exactly one existing account among direct email links with a positive `latest_verified_at`. Missing/unverified direct links and third-party profile emails are not used for initial matching. Email values are normalized and deduplicated. The account returned by Privy must match the verified token subject. Existing bindings can resolve without current email links; email changes cannot silently remap them.

Database migration `20261006130000_oauth_account_identities.sql` serializes first links by app/subject. It rejects zero/multiple matching accounts without creating one. Account deletion preserves a null-account identity tombstone; that identity cannot silently bind again. An explicit account-recovery flow is still needed for linking conflicts/deleted accounts. Browser-supplied email or account IDs must never be passed to the resolver RPC as verification evidence.

Identity tests use mocked Privy responses and real PostgreSQL contract tests separately. Real Privy login, provider timestamp semantics for imported accounts, and browser consent integration remain release gates. The installed Privy SDK defines the direct email-link timestamp fields; [Privy's documented webhook payload](https://docs.privy.io/guide/server/webhooks/verify) shows the corresponding server user object. Neither source replaces a live verification test of the configured Recoup app.

## Next.js boundary

`createOAuthNodeHandler` mounts the provider at the configured `/api/oauth` path. The mounted Pages API route exports `api.bodyParser: false` and `api.externalResolver: true` and awaits the Node handler. App Router Web Request/Response objects are not interchangeable with Node streams.

The boundary rejects a mismatched Host header, restores the request after handling it, and overwrites forwarded host/protocol from the canonical configured issuer before invoking the provider. Set the provider's proxy mode when deployed behind TLS termination. Never derive the issuer from arbitrary request headers. HTTPS is required except IPv4 loopback fixtures.

The test runs actual HTTP through the installed Next Pages `apiResolver`, registers a client with a JSON body, sends a URL-encoded token request, and verifies path-aware discovery and rejection of host spoofing. When the PostgreSQL runner is used, this provider also uses the encrypted database adapter. This proves the Next request/response boundary, not a deployed Vercel route, middleware behavior, or stable production secrets.

## Remaining acceptance

Current source includes discovery/registration controls, delegated tool authorization and owner-authenticated connection listing/revocation; these are not unimplemented integration steps. The maintained [runtime guide](mcp-oauth-runtime.md) links their controlled evidence and remaining limits. Per-connection selected-organization grants are still distinct from full-scope execution checks across currently accessible workspaces.

[Mono #215](https://github.com/recoupable/mono/issues/215) retains the per-host login, write/read-back, expiry/refresh, revoke/reconnect and failure matrix. Real Privy identity behavior, deployed configuration, organization/role policy and the remaining launch criteria need their specific evidence; a source test does not establish them. Any environment enablement, disablement, migration or rollback follows its owning release authorization, not the historical spike's initial rollout instructions.
